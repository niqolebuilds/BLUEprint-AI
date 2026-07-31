import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

// Load .env.local first (developer secrets), then fall back to .env. dotenv does
// not overwrite already-set vars, so the first file to define a key wins.
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = 3000;

// FAST tier: narrative extraction/structuring — high volume, low judgment required.
const GEMINI_MODEL_FAST = process.env.GEMINI_MODEL_FAST || 'gemini-3.6-flash';

// REASONING tier: classification, scoring, and roadmap judgment — same Flash pricing,
// just spends more on "thinking" tokens where accuracy matters more than speed.
const GEMINI_MODEL_REASONING = process.env.GEMINI_MODEL_REASONING || 'gemini-3.6-flash';

// The fixed lines-of-work taxonomy. The AI must map each process to exactly one.
const LINES_OF_WORK = [
  'Procurement',
  'Financial Planning and Corporate Analysis',
  'System Accountant',
  'Power BI Data Control',
  'Financial Controller',
  'Tax Management',
  'Transactional Accounting',
  'Management Reporting',
  'Financial Analysis',
  'Management Report',
  'Account Receivable',
  'Corporate Finance',
  'Internal Audit',
  'Investment',
  'Revenue Assurance',
  'OPEX Optimisation',
  'CAPEX Control and Capital Investment',
  'Profitablity and Productivity',
];

app.use(express.json({ limit: '2mb' }));

// Initialize Gemini Client Lazily and Safely
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        aiClient = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch (err) {
        console.error('Failed to initialize GoogleGenAI client:', err);
      }
    }
  }
  return aiClient;
}

type Classification = 'agentic-ai' | 'automation' | 'human-in-the-loop';

function classifyText(text: string): { aiClassification: Classification; aiRationale: string } {
  const t = text.toLowerCase();
  if (/reconcile|match|verify|evaluate|analy[sz]e|extract|interpret|investigate|review email|cross-?reference/.test(t)) {
    return {
      aiClassification: 'agentic-ai',
      aiRationale:
        'Cross-referencing, fuzzy matching or interpreting unstructured data requires cognitive reasoning — a strong fit for an agentic AI worker.',
    };
  }
  if (/approve|sign|authori[sz]e|escalate|submit to (management|director)|audit sign|legal|physical/.test(t)) {
    return {
      aiClassification: 'human-in-the-loop',
      aiRationale:
        'Requires accountable sign-off, policy compliance or a physical action — keep a human in the loop with AI preparing the decision pack.',
    };
  }
  return {
    aiClassification: 'automation',
    aiRationale:
      'Structured data, clear rules and high repetition — a classic candidate for RPA/API automation.',
  };
}

/**
 * Canonical system map — the authoritative "System Used Map" for the finance
 * directorate. Each entry maps detection patterns to the official system name
 * and its type/domain. Keep this in sync with MOCK_SYSTEMS in src/data/mockData.ts.
 */
const SYSTEM_MAP: Array<{ pattern: RegExp; system: string; domain: string }> = [
  {
    pattern: /kairos|\bhis\b|hospital information|\bhope\b|registration|\bpas\b|\bpay\b|cashier|point.?of.?sale|\bopd\b|\bipd\b|\bmcu\b/i,
    system: 'KAIROS (Hospital Information System)',
    domain: 'Clinical Data Layer',
  },
  {
    pattern: /\bemr\b|e-?medical record|electronic medical record|doctor consult|pharmacy script|radiology order|lab order|revenue leakage/i,
    system: 'EMR (Electronic Medical Record)',
    domain: 'Clinical Data Layer',
  },
  {
    pattern: /d365|dynamics ?365|axapta|\berp\b|general ledger|\bgl\b|accounts payable|\bap\b|accounts receivable|\bar\b|fixed asset|month.?end close/i,
    system: 'Microsoft Dynamics 365 (ERP)',
    domain: 'Enterprise Resource Planning (Financial Core)',
  },
  {
    pattern: /vendor portal|purchase request|\bpr portal\b|purchase order|\bpo\b|goods received|\bgrn\b|procurement|three.?way match|3-?way match/i,
    system: 'Purchase Request (PR) & Vendor Portal',
    domain: 'Procurement E-System',
  },
  {
    pattern: /djp|e-?faktur|tax portal|faktur pajak|\bppn\b|\bvat\b|tax invoice/i,
    system: 'DJP Online e-Faktur',
    domain: 'Tax Compliance Portal',
  },
  {
    pattern: /bpjs|e-?clai?m|e-?klaim|ina-?cbg|insurance claim|claim rejection|ar aging/i,
    system: 'BPJS e-Claim Portal',
    domain: 'Insurance / Reinsurance Portal',
  },
  {
    pattern: /cimb|niaga|cash management|host.?to.?host|bank clearance|disbursement|treasury|payroll|cash reconciliation/i,
    system: 'CIMB Niaga Cash Management',
    domain: 'Corporate Banking Platform',
  },
  {
    pattern: /power ?bi|\bdax\b|dashboard|heatmap/i,
    system: 'Microsoft Power BI',
    domain: 'Analytics & Presentation Layer',
  },
  {
    pattern: /excel|spreadsheet|workbook|xlsx|pivot/i,
    system: 'Microsoft Excel',
    domain: 'Analytics & Presentation Layer',
  },
  {
    pattern: /powerpoint|\bppt\b|slide|deck|presentation/i,
    system: 'Microsoft PowerPoint',
    domain: 'Analytics & Presentation Layer',
  },
];

/** The official system names, for prompting the model to use consistent labels. */
const SYSTEM_REFERENCE = SYSTEM_MAP.map((s) => `${s.system} — ${s.domain}`);

function detectSystems(text: string): string[] {
  return SYSTEM_MAP.filter((h) => h.pattern.test(text)).map((h) => h.system);
}

/** Map free text to exactly one allowed line of work (used to coerce/guess). */
function guessLineOfWork(text: string): string {
  const t = text.toLowerCase();
  if (/tax|faktur|djp|vat|ppn|pph/.test(t)) return 'Tax Management';
  if (/procure|vendor|purchase|\bpo\b|payable|\bap\b/.test(t)) return 'Procurement';
  if (/claim|billing|bpjs|receivable|\bar\b|collection|dunning/.test(t)) return 'Account Receivable';
  if (/revenue assurance|leakage|revenue integrity/.test(t)) return 'Revenue Assurance';
  if (/audit|risk|assurance|compliance check|internal control/.test(t)) return 'Internal Audit';
  if (/capex|capital expenditure|capital investment/.test(t)) return 'CAPEX Control and Capital Investment';
  if (/opex|operating expense|cost saving|efficiency drive/.test(t)) return 'OPEX Optimisation';
  if (/investment|portfolio|fund placement|deposito|treasury placement/.test(t)) return 'Investment';
  if (/power ?bi|dashboard|data model|\bdax\b/.test(t)) return 'Power BI Data Control';
  if (/budget|forecast|variance|fp&a|corporate analysis|planning/.test(t)) return 'Financial Planning and Corporate Analysis';
  if (/management report|board report|monthly report|reporting pack/.test(t)) return 'Management Reporting';
  if (/profitab|productivity|margin analysis/.test(t)) return 'Profitablity and Productivity';
  if (/controller|month.?end close|general ledger|\bgl\b|journal|reconcil/.test(t)) return 'Financial Controller';
  if (/treasury|cash flow|liquidity|bank|financing|corporate finance/.test(t)) return 'Corporate Finance';
  if (/master data|chart of account|erp config|system setup/.test(t)) return 'System Accountant';
  if (/analysis|analyt/.test(t)) return 'Financial Analysis';
  return 'Transactional Accounting';
}

/** Segment a dump into candidate process blocks (offline heuristic). */
function segmentBlocks(text: string): string[] {
  const byBlank = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  return byBlank.length > 1 ? byBlank : [text.trim()];
}

/** Turn a block of text into ordered, classified steps (rule-based). */
function buildRuleSteps(text: string) {
  const fragments = text
    .split(/\r?\n+|(?<=[.!?])\s+(?=[A-Z0-9])|(?:^|\s)(?:then|after that|next,|afterwards|finally|lastly)[,\s]+/gi)
    .map((f) => (f || '').replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*|step \d+[:.]?\s*)/i, '').trim())
    .filter((f) => f.length > 12);

  const seen = new Set<string>();
  const unique = fragments.filter((f) => {
    const key = f.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 12).map((fragment, idx) => {
    const { aiClassification, aiRationale } = classifyText(fragment);
    const detectedForStep = detectSystems(fragment);
    const systems =
      detectedForStep.length > 0
        ? detectedForStep
        : /excel|report|model|spreadsheet|dashboard|power ?bi/i.test(fragment)
          ? ['Microsoft Excel [Inferred Ecosystem]']
          : ['Microsoft Dynamics 365 (ERP) [Inferred Ecosystem]'];
    const sentence = fragment.replace(/\s+/g, ' ');
    const name = sentence.length > 64 ? sentence.slice(0, 61).replace(/\s+\S*$/, '') + '…' : sentence;
    return {
      order: idx + 1,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: `Trigger: previous step completed. Action: ${sentence.charAt(0).toLowerCase() + sentence.slice(1)} Expected result: step output verified and logged.`,
      inputs: idx === 0 ? ['Source documents / prior period data'] : [`Output of step ${idx}`],
      outputs: ['Completed step record'],
      decisionPoints: /if |whether |depending/i.test(fragment) ? ['Condition described in the narrative — confirm the branch rule.'] : [],
      systems,
      handOffs: /send|forward|escalate|share|notify|email/i.test(fragment) ? ['Hand-off to the named recipient — confirm who receives it.'] : [],
      aiClassification,
      aiRationale,
    };
  });
}

/** Derive a readable process title from a block and its mined steps. */
function deriveTitle(block: string, steps: Array<{ name: string }>): string {
  const firstLine = block.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
  const base = firstLine.replace(/^[\[(].*?[\])]\s*/, '').slice(0, 60).trim();
  return (base || steps[0]?.name || 'Working process').replace(/[.:]$/, '');
}

/**
 * POST /api/ai/mine — the "Understanding Agentic AI" miner.
 * Takes free text (typed, dictated, or extracted from uploaded working
 * outputs) and returns counted, expanded, classified structured steps.
 */
app.post('/api/ai/mine', async (req, res) => {
  const { title, description, sourceTexts, availableSystems } = req.body as {
    title?: string;
    description?: string;
    sourceTexts?: string[];
    availableSystems?: Array<{ name: string; category: string; description?: string }>;
  };

  const narrative = [description || '', ...(sourceTexts || [])].filter(Boolean).join('\n\n').trim();
  if (!narrative) {
    return res.status(400).json({ error: 'Provide a process description or uploaded working outputs to mine.' });
  }

  const ai = getGeminiClient();

  if (ai) {
    try {
      console.log(`Mining process narrative (${narrative.length} chars) with Gemini...`);

      const systemsToUse = Array.isArray(availableSystems) && availableSystems.length > 0
        ? availableSystems
        : SYSTEM_MAP.map(s => ({ name: s.system, category: s.domain, description: '' }));

      const systemReferencePrompt = systemsToUse
        .map((s) => `- ${s.name} [Category: ${s.category}]${s.description ? ` - Capabilities & AI Context: ${s.description}` : ''}`)
        .join('\n             ');

      const prompt = `
        You are the Enterprise Process Architecture Engine for a hospital group's finance directorate.
        A staff member described how they work, in their own words — possibly dictated by voice,
        possibly pasted from documents, prompts, or rough notes. The text may be messy, use heavy
        jargon, mix English and Bahasa Indonesia, or contain instructions/context that are NOT part
        of their actual work. Your job is to DISCERN the real finance work being performed, however
        complex or disorganised the wording is.

        ${title ? `The user's working title (a hint only — improve on it freely): ${title}` : ''}
        Raw input:
        """
        ${narrative}
        """

        STAGE 1 — SEGMENT INTO DISTINCT PROCESSES.
        A single dump usually describes SEVERAL separate work processes (distinct objectives or
        workstreams). Work out how many DISTINCT processes are present and separate them cleanly.
        Never merge two unrelated workstreams, and never let details from one process bleed into
        another. Discard meta-content that is not real finance work (e.g. "act as a designer",
        "I am building an app", greetings, formatting notes). If the dump truly describes only one
        process, return exactly one.

        STAGE 2 — For EACH distinct process, produce:
        - title: a concise, professional process name.
        - subFunction: the SINGLE best-fitting line of work, chosen EXACTLY and VERBATIM from this
          fixed list (never invent, never combine two):
          ${LINES_OF_WORK.map((l) => `"${l}"`).join(', ')}.
        - summary: one sentence on what this process achieves.
        - steps: the ordered steps. For each step apply this 5-layer matrix:
          1. name + description written as Trigger -> Action -> Expected result, unambiguous.
          2. systems: tools/ERP/infra used. Use the OFFICIAL system name from this list whenever it
             applies (match on their custom capabilities, context, and categories):
             ${systemReferencePrompt}
             If a step clearly uses a tool that is unstated, infer the most logical fit from this
             list and append " [Inferred Ecosystem]" to that system name. Only use a name outside
             this list if the work genuinely involves a system not listed here.
          3. inputs & outputs: preserve data dependencies — one step's output should equal the next
             step's input wherever the flow is sequential.
          4. decisionPoints & handOffs.
          5. aiClassification: 'agentic-ai' (reasoning over unstructured data / exceptions),
             'automation' (structured, rule-based, repetitive) or 'human-in-the-loop' (accountable
             approval, legal/physical action) + a short aiRationale.

        Also return processCount (how many distinct processes you found) and an overallSummary that
        states that count and what you understood.

        Respond strictly in the requested JSON schema format.
      `;

      const stepSchema = {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.INTEGER },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          inputs: { type: Type.ARRAY, items: { type: Type.STRING } },
          outputs: { type: Type.ARRAY, items: { type: Type.STRING } },
          decisionPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          systems: { type: Type.ARRAY, items: { type: Type.STRING } },
          handOffs: { type: Type.ARRAY, items: { type: Type.STRING } },
          aiClassification: {
            type: Type.STRING,
            description: "Must be exactly one of: 'agentic-ai', 'automation', 'human-in-the-loop'",
          },
          aiRationale: { type: Type.STRING },
        },
        required: ['order', 'name', 'description', 'aiClassification', 'aiRationale'],
      };

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_FAST,
        contents: prompt,
        config: {
          systemInstruction:
            'You segment a messy first-person finance work narrative into DISTINCT, non-overlapping processes, then expand each into precise structured steps. You never merge unrelated workstreams, you discard non-work meta-content, and you map each process to exactly one allowed line of work.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              processCount: { type: Type.INTEGER },
              overallSummary: { type: Type.STRING },
              processes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subFunction: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: stepSchema },
                  },
                  required: ['title', 'subFunction', 'steps'],
                },
              },
            },
            required: ['processCount', 'overallSummary', 'processes'],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini API');
      }

      const parsed = JSON.parse(responseText.trim());
      // Guard: force every subFunction onto the allowed list; keep count honest.
      if (Array.isArray(parsed.processes)) {
        for (const p of parsed.processes) {
          if (!LINES_OF_WORK.includes(p.subFunction)) {
            p.subFunction = guessLineOfWork(`${p.title || ''} ${p.summary || ''}`);
          }
        }
        parsed.processCount = parsed.processes.length;
      }
      return res.json(parsed);
    } catch (err: any) {
      console.error('Gemini mining failed, falling back to rule-based miner:', err.message);
    }
  }

  // Rule-based fallback miner — segments by paragraph blocks so a multi-process
  // dump still splits into several processes. Always available so the journey never stalls.
  console.log('Using server-side rule-based process miner...');

  const blocks = segmentBlocks(narrative);
  const processes = blocks
    .map((block) => {
      const steps = buildRuleSteps(block);
      return {
        title: title && blocks.length === 1 ? title : deriveTitle(block, steps),
        subFunction: guessLineOfWork(block),
        summary: `${steps.length} step${steps.length === 1 ? '' : 's'} captured from this block.`,
        steps,
      };
    })
    .filter((p) => p.steps.length > 0);

  const safe =
    processes.length > 0
      ? processes
      : [
          {
            title: title || 'Untitled working process',
            subFunction: guessLineOfWork(narrative),
            summary: 'Rule-based capture.',
            steps: buildRuleSteps(narrative),
          },
        ];

  return res.json({
    processCount: safe.length,
    overallSummary: `I found ${safe.length} distinct process${
      safe.length === 1 ? '' : 'es'
    } in your input, and expanded each into trigger/action/result steps. This offline pass is lighter than the AI engine — review and adjust anything I misread.`,
    processes: safe,
  });
});

// API Routes
app.post('/api/ai/analyze', async (req, res) => {
  const { title, description, steps, availableSystems } = req.body;

  if (!title || !steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Missing process title, description, or steps' });
  }

  const ai = getGeminiClient();

  if (ai) {
    try {
      console.log(`Analyzing process "${title}" with Gemini...`);

      const systemsToUse = Array.isArray(availableSystems) && availableSystems.length > 0
        ? availableSystems
        : SYSTEM_MAP.map(s => ({ name: s.system, category: s.domain, description: '' }));

      const systemReferencePrompt = systemsToUse
        .map((s) => `- ${s.name} [Category: ${s.category}]${s.description ? ` - Capabilities & AI Context: ${s.description}` : ''}`)
        .join('\n             ');

      const prompt = `
        You are an expert AI systems architect and process automation consultant specializing in healthcare finance workflows.
        Analyze the following process from Siloam Hospitals Group - Finance Directorate and refine it for native-AI transformation.

        Process Title: ${title}
        Process Description: ${description || 'No description provided'}

        Registered Systems & Tools Catalogue (Context for your proposals):
        Use these systems, their categories, and custom capabilities as your core architectural context to propose relevant API connections, agentic automation, and streamlining:
        ${systemReferencePrompt}

        Steps:
        ${JSON.stringify(steps, null, 2)}

        Tasks:
        1. Refine each step description to be extremely precise, machine-readable, and unambiguous (include clear triggers, actions, and expected results).
        2. Suggest relevant inputs and outputs for each step if they seem incomplete.
        3. Classify each step as either:
           - 'agentic-ai': Requires reasoning, interpreting unstructured data (e.g., medical charts, emails, free-form text), handling complex exceptions, or synthesized decision-making.
           - 'automation': High repetition, structured data, clear rules, API queries, database entries, static forms.
           - 'human-in-the-loop': Requires legal approval, medical-clinical sign-off, or physical signatures/actions with high accountability.
        4. Provide a solid rationale for each classification.
        5. Identify gaps or ambiguities in the process (e.g., missing approvals, unverified billing codes, un-integrated portals).
        6. Determine an overall Automation Suitability Score (0 to 100) and grade the drivers (Volume, Repetitiveness, Rule-clarity, Error-sensitivity) from 1 to 5.

        Rules:
        - Preserve data dependencies: where steps are sequential, one step's suggested Output must equal the next step's suggested Input.
        - Prefer using the registered systems/tools above whenever applicable. Rely on their described capabilities to justify your classifications (e.g., if a system supports REST APIs, note that it is easily automatable).
        - If you name a system that the user did not state, append " [Inferred Ecosystem]" to it.
        - Never conflate two distinct tasks into one step; keep each workstream separate.

        Respond strictly in the requested JSON schema format.
      `;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_REASONING,
        contents: prompt,
        config: {
          systemInstruction: 'You are a professional healthcare systems optimization consultant. You analyze hospital financial processes for digital and AI transformation.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              refinedTitle: { type: Type.STRING },
              refinedDescription: { type: Type.STRING },
              refinedSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    order: { type: Type.INTEGER },
                    name: { type: Type.STRING },
                    refinedDescription: { type: Type.STRING },
                    suggestedInputs: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggestedOutputs: { type: Type.ARRAY, items: { type: Type.STRING } },
                    aiClassification: {
                      type: Type.STRING,
                      description: "Must be exactly one of: 'agentic-ai', 'automation', 'human-in-the-loop'"
                    },
                    aiRationale: { type: Type.STRING }
                  },
                  required: ['order', 'name', 'refinedDescription', 'aiClassification', 'aiRationale']
                }
              },
              gaps: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              automationSuitability: { type: Type.INTEGER },
              drivers: {
                type: Type.OBJECT,
                properties: {
                  volume: { type: Type.INTEGER, description: '1 to 5' },
                  repetitiveness: { type: Type.INTEGER, description: '1 to 5' },
                  ruleClarity: { type: Type.INTEGER, description: '1 to 5' },
                  errorSensitivity: { type: Type.INTEGER, description: '1 to 5' },
                  summary: { type: Type.STRING }
                },
                required: ['volume', 'repetitiveness', 'ruleClarity', 'errorSensitivity', 'summary']
              },
              recommendedAction: { type: Type.STRING }
            },
            required: ['refinedTitle', 'refinedDescription', 'refinedSteps', 'gaps', 'automationSuitability', 'drivers', 'recommendedAction']
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini API');
      }

      const analysisResult = JSON.parse(responseText.trim());
      return res.json(analysisResult);

    } catch (err: any) {
      console.error('Gemini API execution failed, falling back to rule-based engine:', err.message);
      // Fallback is handled below the catch block
    }
  }

  // Smart Rule-Based Fallback Engine
  // This executes when GEMINI_API_KEY is not defined or if the API call fails,
  // ensuring the user gets high-quality, relevant results in the preview.
  console.log('Using server-side local rule-based fallback analyzer...');

  const refinedSteps = steps.map((step: any) => {
    const { aiClassification, aiRationale } = classifyText(step.name + ' ' + step.description);

    const suggestedInputs = step.inputs && step.inputs.length > 0 ? step.inputs : ['Standard Operating Document', 'ERP Data Fields'];
    const suggestedOutputs = step.outputs && step.outputs.length > 0 ? step.outputs : ['Completed Step Ledger Entry', 'Status Flag Update'];

    return {
      order: step.order,
      name: step.name,
      refinedDescription: `[REFINED] ${step.description || 'Step execution.'} (Trigger: Input verification completed. Action: Process data in target system. Expected Result: Audit log successfully generated.)`,
      suggestedInputs,
      suggestedOutputs,
      aiClassification,
      aiRationale
    };
  });

  const gaps = [
    `Unintegrated system silo spotted in "${title}": data requires manual re-entry between systems.`,
    'Absence of an automated exception-handling route for mismatched data points.',
    'Dual-authority manual approvals create a high-friction turnaround delay.'
  ];

  const volume = title.toLowerCase().includes('bpjs') || title.toLowerCase().includes('invoice') ? 5 : 4;
  const repetitiveness = title.toLowerCase().includes('reconciliation') || title.toLowerCase().includes('match') ? 5 : 3;
  const ruleClarity = title.toLowerCase().includes('tax') ? 5 : 4;
  const errorSensitivity = 5;
  const automationSuitability = Math.round(((volume + repetitiveness + ruleClarity + (6 - errorSensitivity)) / 20) * 100);

  return res.json({
    refinedTitle: `Refined: ${title}`,
    refinedDescription: `Refined execution of ${title}. ${description || 'This process maps out manual and cognitive operations to find automation potentials.'}`,
    refinedSteps,
    gaps,
    automationSuitability,
    drivers: {
      volume,
      repetitiveness,
      ruleClarity,
      errorSensitivity,
      summary: 'High transaction frequency and structured rules create an excellent baseline for automation, with specific cognitive tasks fitting agentic models.'
    },
    recommendedAction: 'Move to the next stage of Project Vanguard: include this process as a core candidate for the upcoming internal AI Hackathon or design an automated RPA integration.'
  });
});

/**
 * US-Deploy: Propose a basic automation/agentic AI step-by-step deployment plan
 * based on the selected process steps and registered systems catalog.
 */
app.post('/api/ai/propose-deployment', async (req, res) => {
  const {
    title,
    description,
    steps,
    availableSystems,
    effortRating,
    volumeRating,
    repetitivenessRating,
    errorSensitivityRating
  } = req.body as {
    title?: string;
    description?: string;
    steps?: any[];
    availableSystems?: Array<{ name: string; category: string; description?: string }>;
    effortRating?: number;
    volumeRating?: number;
    repetitivenessRating?: number;
    errorSensitivityRating?: number;
  };

  if (!title || !steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Missing process title or steps for deployment mapping' });
  }

  // Pre-calculate highly accurate dynamic metrics based on process parameters
  const vol = volumeRating || 3;
  const eff = effortRating || 3;
  const sens = errorSensitivityRating || 3;
  const stepsCount = steps.length || 5;

  const monthlyTransactions = vol === 1 ? 100 : vol === 2 ? 300 : vol === 3 ? 1000 : vol === 4 ? 3500 : 10000;
  const minutesPerTx = (eff === 1 ? 5 : eff === 2 ? 15 : eff === 3 ? 30 : eff === 4 ? 60 : 120) * (stepsCount / 4);
  const totalManualHoursPerMonth = Math.round((monthlyTransactions * minutesPerTx) / 60);
  const hoursSavedPerMonth = Math.min(totalManualHoursPerMonth, 160 * (1 + vol * 0.8));

  // Labor wage rate in Indonesia: Rp 50.000/hour (~ $3.125 USD/hour)
  const laborSavingsUSD = hoursSavedPerMonth * 3.125;
  // Accuracy savings: error/denial leakage prevented
  const accuracySavingsUSD = monthlyTransactions * (sens * 0.15);
  const estimatedAnnualSavingsUSD = Math.round((laborSavingsUSD + accuracySavingsUSD) * 12);

  // Development hours & subscription costs
  const estimatedDevelopmentHours = Math.max(40, stepsCount * (eff * 6 + 4));
  // Note: developer salary is excluded from total investment displays in frontend,
  // but let's calculate the dev cost in USD (one-time fee):
  const developmentCostUSD = estimatedDevelopmentHours * 25;

  const isAgentic = title.toLowerCase().includes('recommend') || title.toLowerCase().includes('analyze') || title.toLowerCase().includes('audit') || title.toLowerCase().includes('agentic') || title.toLowerCase().includes('ai');
  const recommendedSolutionType = isAgentic ? 'Agentic AI' : 'RPA / Automation';

  // Subscription cost based on tool type: Agentic AI relies on Gemini Flash (which is extremely cheap!)
  const annualSubscriptionCostUSD = recommendedSolutionType === 'Agentic AI'
    ? Math.max(120, Math.round(monthlyTransactions * 0.05)) // extremely low Gemini API & Make.com costs
    : Math.max(1200, Math.round(monthlyTransactions * 0.2)); // UiPath unattended bot is higher

  const paybackPeriodMonths = Math.max(1, Math.round(developmentCostUSD / Math.max(1, laborSavingsUSD + accuracySavingsUSD)));
  const roiPercent = Math.max(50, Math.round(((estimatedAnnualSavingsUSD - annualSubscriptionCostUSD) / Math.max(1, developmentCostUSD)) * 100));

  const calculatedCBA = {
    estimatedDevelopmentHours,
    developmentCostUSD,
    annualSubscriptionCostUSD,
    estimatedAnnualSavingsUSD,
    paybackPeriodMonths,
    roiPercent,
    manualHoursReducedPerMonth: Math.round(hoursSavedPerMonth)
  };

  const systemsToUse = Array.isArray(availableSystems) && availableSystems.length > 0
    ? availableSystems
    : SYSTEM_MAP.map(s => ({ name: s.system, category: s.domain, description: '' }));

  const systemReferencePrompt = systemsToUse
    .map((s) => `- ${s.name} [Category: ${s.category}]${s.description ? ` - Capabilities & AI Context: ${s.description}` : ''}`)
    .join('\n             ');

  const ai = getGeminiClient();
  if (ai) {
    try {
      console.log(`Generating automation/agentic deployment roadmap for "${title}" with Gemini...`);

      const prompt = `
        You are an expert AI systems architect, RPA developer, and process automation consultant specializing in healthcare finance workflows.
        Propose a basic, step-by-step automation or Agentic AI deployment plan for the following healthcare finance workflow:

        Process Title: ${title}
        Process Description: ${description || 'No description provided'}

        Registered Systems & Tools Catalogue (Use these to ground your deployment steps):
        ${systemReferencePrompt}

        Workflow Steps:
        ${JSON.stringify(steps, null, 2)}

        CRITICAL FINANCIAL CONSTRAINTS (You MUST output EXACTLY these costBenefitAnalysis numbers):
        - estimatedDevelopmentHours: ${calculatedCBA.estimatedDevelopmentHours}
        - developmentCostUSD: ${calculatedCBA.developmentCostUSD}
        - annualSubscriptionCostUSD: ${calculatedCBA.annualSubscriptionCostUSD}
        - estimatedAnnualSavingsUSD: ${calculatedCBA.estimatedAnnualSavingsUSD}
        - paybackPeriodMonths: ${calculatedCBA.paybackPeriodMonths}
        - roiPercent: ${calculatedCBA.roiPercent}
        - manualHoursReducedPerMonth: ${calculatedCBA.manualHoursReducedPerMonth}

        Generate:
        1. A structured, extremely practical, step-by-step deployment roadmap to turn this process from manual/siloed into an automated or agentic system.
           Classify the solution type as either 'RPA / Automation' (if rule-based/predictable), 'Agentic AI' (if cognitive, language-based, or decision-heavy), or 'Hybrid System'.
           Produce exactly 4 phases:
           - Phase 1: Preparation & System Integration (API access, credentialing, data schema mapping)
           - Phase 2: Pipeline / Logic Setup (creating agents, prompts, or RPA automation scripts)
           - Phase 3: Human-in-the-Loop & Validation Gate (reconciliation check, exception routing, audit trails)
           - Phase 4: Scaling & Continuous Monitoring (feedback loops, alerting, logs)
        2. A Cost-Benefit Analysis containing EXACTLY the pre-calculated numbers listed above.
        3. A list of 2-3 additional subscriptions or tool tools required (e.g., OpenAI API, UiPath Cloud, Twilio, Make.com, PDF.co, Google Cloud Document AI) with their typical monthly cost in USD and the precise Key Activities they enable.
        4. A list of 2-3 key strategic partnerships (e.g., IT Operations Subdirectorate, BPJS Integration Unit, Vendor Bank Gateway) required to capture this value and benefits.

        Respond ONLY with a valid JSON object matching this schema:
        {
          "processTitle": string,
          "recommendedSolutionType": "RPA / Automation" | "Agentic AI" | "Hybrid System",
          "deploymentSteps": [
            {
              "phase": string,
              "title": string,
              "description": string,
              "systemsInvolved": string[],
              "actionItems": string[]
            }
          ],
          "costBenefitAnalysis": {
            "estimatedDevelopmentHours": number,
            "developmentCostUSD": number,
            "annualSubscriptionCostUSD": number,
            "estimatedAnnualSavingsUSD": number,
            "paybackPeriodMonths": number,
            "roiPercent": number,
            "manualHoursReducedPerMonth": number
          },
          "additionalSubscriptions": [
            {
              "toolName": string,
              "monthlyCostUSD": number,
              "linkedKeyActivity": string
            }
          ],
          "strategicPartnerships": [
            {
              "partnerName": string,
              "roleDescription": string,
              "benefitsCaptured": string
            }
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_REASONING,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              processTitle: { type: Type.STRING },
              recommendedSolutionType: {
                type: Type.STRING,
                description: "Must be exactly one of: 'RPA / Automation', 'Agentic AI', 'Hybrid System'"
              },
              deploymentSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phase: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    systemsInvolved: { type: Type.ARRAY, items: { type: Type.STRING } },
                    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['phase', 'title', 'description', 'systemsInvolved', 'actionItems']
                }
              },
              costBenefitAnalysis: {
                type: Type.OBJECT,
                properties: {
                  estimatedDevelopmentHours: { type: Type.INTEGER },
                  developmentCostUSD: { type: Type.INTEGER },
                  annualSubscriptionCostUSD: { type: Type.INTEGER },
                  estimatedAnnualSavingsUSD: { type: Type.INTEGER },
                  paybackPeriodMonths: { type: Type.INTEGER },
                  roiPercent: { type: Type.INTEGER },
                  manualHoursReducedPerMonth: { type: Type.INTEGER }
                },
                required: [
                  'estimatedDevelopmentHours',
                  'developmentCostUSD',
                  'annualSubscriptionCostUSD',
                  'estimatedAnnualSavingsUSD',
                  'paybackPeriodMonths',
                  'roiPercent',
                  'manualHoursReducedPerMonth'
                ]
              },
              additionalSubscriptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    toolName: { type: Type.STRING },
                    monthlyCostUSD: { type: Type.INTEGER },
                    linkedKeyActivity: { type: Type.STRING }
                  },
                  required: ['toolName', 'monthlyCostUSD', 'linkedKeyActivity']
                }
              },
              strategicPartnerships: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    partnerName: { type: Type.STRING },
                    roleDescription: { type: Type.STRING },
                    benefitsCaptured: { type: Type.STRING }
                  },
                  required: ['partnerName', 'roleDescription', 'benefitsCaptured']
                }
              }
            },
            required: [
              'processTitle',
              'recommendedSolutionType',
              'deploymentSteps',
              'costBenefitAnalysis',
              'additionalSubscriptions',
              'strategicPartnerships'
            ]
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        return res.json(JSON.parse(responseText.trim()));
      }
    } catch (err: any) {
      console.error('Gemini deployment plan generation failed, falling back to local builder:', err.message);
    }
  }

  // Local fallback engine for deployment plans:
  console.log('Generating local deployment plan for:', title);

  const plan = {
    processTitle: title,
    recommendedSolutionType: recommendedSolutionType,
    deploymentSteps: [
      {
        phase: "Phase 1: Preparation & System Integration",
        title: "API Credentialing & Schema Standardization",
        description: `Set up secure credentials for systems mapped to "${title}". Standardize the input and output JSON structure to ensure seamless hand-offs.`,
        systemsInvolved: steps.flatMap(s => s.systems).slice(0, 3),
        actionItems: [
          "Request service accounts for relevant transactional systems (e.g., ERP ledger or EHR portals).",
          "Map the precise schemas of incoming payloads to guarantee input validation.",
          "Establish an isolated staging environment for development and unit testing."
        ]
      },
      {
        phase: "Phase 2: Pipeline / Logic Setup",
        title: `${recommendedSolutionType === 'Agentic AI' ? 'Cognitive LLM Prompt Engineering' : 'Scripted Robotic Logic'} Implementation`,
        description: `Develop the core engine of the workflow—either ${recommendedSolutionType === 'Agentic AI' ? 'agentic prompt chains targeting unstructured text parsing' : 'structured automation flows targeting rapid form entry and web scraping'}.`,
        systemsInvolved: ["Vanguard AI Core Server"],
        actionItems: [
          recommendedSolutionType === 'Agentic AI' 
            ? "Author robust system prompts with few-shot examples for categorical sorting and extraction."
            : "Write headless browser automation scripts or REST integrations for repetitive web-clicks.",
          "Handle multi-system data dependency pipelines where step output perfectly mirrors step input.",
          "Incorporate rigorous data verification check-sums before making write-backs."
        ]
      },
      {
        phase: "Phase 3: Human-in-the-Loop & Validation Gate",
        title: "Discrepancy Handling & Exception Queue",
        description: "Configure the validation UI gate. Instead of direct automated writes, flag high-risk anomalies, low-confidence scores, or discordant entries for manager-level approval.",
        systemsInvolved: ["Vanguard Front-End Validation Panel"],
        actionItems: [
          "Build a simple task review screen for supervisor approvals of outbound ERP logs.",
          "Implement an automatic fallback alert to notify staff via a system broadcast if API limits are reached.",
          "Log full transaction history logs securely in local databases for post-execution audits."
        ]
      },
      {
        phase: "Phase 4: Scaling & Continuous Monitoring",
        title: "Performance Dashboards & Alerting",
        description: "Formally launch into production. Build a feedback mechanism to measure processed-volume speedups, error reduction rate, and employee effort-release.",
        systemsInvolved: ["Microsoft Power BI [Inferred Ecosystem]", "Directorate Dashboard"],
        actionItems: [
          "Link the operational output metrics directly to the Directorate CFO performance view.",
          "Perform weekly prompt-tuning (for LLMs) or system selector adjustments (for RPA).",
          "Promote this project in the upcoming Siloam Finance Directorate Vanguard Hackathon."
        ]
      }
    ],
    costBenefitAnalysis: calculatedCBA,
    additionalSubscriptions: [
      {
        toolName: recommendedSolutionType === 'Agentic AI' ? "Google Gemini API (Flash)" : "UiPath Cloud Server License",
        monthlyCostUSD: recommendedSolutionType === 'Agentic AI' ? 80 : 150,
        linkedKeyActivity: recommendedSolutionType === 'Agentic AI' ? "Cognitive context matching, text parsing, and unstructured invoice metadata extraction" : "Automated desktop clicks, PDF scrapers, and legacy EHR navigation bots"
      },
      {
        toolName: "Make.com (Standard Platform)",
        monthlyCostUSD: 29,
        linkedKeyActivity: "Multi-system event hooks, status triggers, and visual data integration loops between finance portals"
      },
      {
        toolName: "Secure OCR Service (PDF.co)",
        monthlyCostUSD: 49,
        linkedKeyActivity: "Digitizing low-contrast patient receipts or BPJS claim forms prior to automation parsing"
      }
    ],
    strategicPartnerships: [
      {
        partnerName: "Siloam IT Security & Infrastructure Directorate",
        roleDescription: "Reviews API access tokens, configures firewall whitelisting, and oversees secure credentials storage.",
        benefitsCaptured: "Guarantees enterprise-grade compliance, HIPAA-compliant patient record access, and continuous service uptime."
      },
      {
        partnerName: "BPJS Claims Verification Department",
        roleDescription: "Aligns schema structure with the latest BPJS updates and establishes automatic endpoint handshakes.",
        benefitsCaptured: "Eliminates verification delays, reduces the claim rejection rate to near-zero, and unlocks accelerated cash-flow cycles."
      }
    ]
  };

  return res.json(plan);
});

/**
 * POST /api/ai/meeting-summary — AI Meeting Assistant endpoint.
 * Takes a transcript/notes text and team member context to produce a structured note
 * with summary, decisions, open questions, and action items with assignees.
 */
app.post('/api/ai/meeting-summary', async (req, res) => {
  const { title, date, participants, rawText, teamMembers } = req.body as {
    title?: string;
    date?: string;
    participants?: string[];
    rawText?: string;
    teamMembers?: Array<{ name: string; email: string }>;
  };

  if (!rawText || !rawText.trim()) {
    return res.status(400).json({ error: 'Meeting transcript or notes text is required.' });
  }

  const membersList = (teamMembers && teamMembers.length > 0)
    ? teamMembers.map(m => `${m.name} (${m.email})`).join(', ')
    : 'Nicole Celia (nicolecelia.work@gmail.com), Hendra Wijaya (hendra.w@siloamhospitals.com)';

  const ai = getGeminiClient();

  if (ai) {
    try {
      console.log(`Generating meeting summary for "${title || 'Meeting'}" with Gemini...`);

      const prompt = `
        You are the AI Project Assistant for Siloam Hospitals Finance Directorate.
        Analyze the following meeting transcript / raw notes and extract structured meeting outputs.

        Meeting Title: ${title || 'Project Meeting'}
        Date: ${date || new Date().toISOString().split('T')[0]}
        Participants: ${(participants || []).join(', ') || 'Project Team'}
        Available Project Team Members: ${membersList}

        Raw Transcript / Notes:
        """
        ${rawText}
        """

        Extract and return:
        1. summary: A clear 2-3 sentence executive summary of what was discussed and agreed.
        2. decisions: Array of key strategic or operational decisions finalized in the meeting.
        3. openQuestions: Array of outstanding questions or unblocked items needing follow-up.
        4. actionItems: Array of specific tasks assigned during the meeting. Match assigneeName and assigneeEmail to available project team members whenever possible. Each item has:
           - description: specific action item
           - assigneeName: full name of assignee
           - assigneeEmail: email address of assignee
           - dueDate: estimated due date in YYYY-MM-DD format (default to 7-14 days from meeting date)

        Respond strictly in the requested JSON schema format.
      `;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_FAST,
        contents: prompt,
        config: {
          systemInstruction: 'You are an executive AI meeting assistant for hospital finance projects.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
              openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    assigneeName: { type: Type.STRING },
                    assigneeEmail: { type: Type.STRING },
                    dueDate: { type: Type.STRING }
                  },
                  required: ['description', 'assigneeName', 'assigneeEmail', 'dueDate']
                }
              }
            },
            required: ['summary', 'decisions', 'openQuestions', 'actionItems']
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      }
    } catch (err: any) {
      console.error('Gemini meeting summary failed, falling back to rule-based engine:', err.message);
    }
  }

  // Fallback rule-based extraction
  console.log('Using rule-based meeting assistant fallback...');
  const defaultMember = (teamMembers && teamMembers[0]) || { name: 'Nicole Celia', email: 'nicolecelia.work@gmail.com' };
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const decisions: string[] = [];
  const openQuestions: string[] = [];
  const actionItems: Array<{ description: string; assigneeName: string; assigneeEmail: string; dueDate: string }> = [];

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const defaultDueDate = futureDate.toISOString().split('T')[0];

  lines.forEach((line) => {
    if (/agreed|decided|approved|confirmed|settled/i.test(line)) {
      decisions.push(line.replace(/^(agreed|decided|approved|confirmed|settled)[:\s-]*/i, ''));
    } else if (/\?|question|open|unresolved|check/i.test(line)) {
      openQuestions.push(line.replace(/^(question|open|check)[:\s-]*/i, ''));
    } else if (/todo|action|assign|will|should|must|by/i.test(line)) {
      actionItems.push({
        description: line.replace(/^(todo|action|assigned to [^:]+):/i, '').trim(),
        assigneeName: defaultMember.name,
        assigneeEmail: defaultMember.email,
        dueDate: defaultDueDate
      });
    }
  });

  if (decisions.length === 0) {
    decisions.push(`Finalized scope alignment for ${title || 'project milestone'}.`);
  }
  if (actionItems.length === 0) {
    actionItems.push({
      description: `Follow up on items discussed in ${title || 'project meeting'}`,
      assigneeName: defaultMember.name,
      assigneeEmail: defaultMember.email,
      dueDate: defaultDueDate
    });
  }

  return res.json({
    summary: `The team held a session on ${title || 'project execution'}. Evaluated current execution progress, verified technical dependencies, and established key deliverables.`,
    decisions,
    openQuestions: openQuestions.length > 0 ? openQuestions : ['Confirm API rate limits with IT Infrastructure for batch operations.'],
    actionItems
  });
});

// Configure Vite or Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware loaded in development mode');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static files from dist/');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Blueprint server running on http://localhost:${PORT}`);
  });
}

startServer();
