/**
 * Does this paper actually study this intervention?
 *
 * Every automated decision downstream — accept a candidate, link a reference,
 * extract a study, write a claim — inherits its truthfulness from this question.
 * Getting it wrong is how creatinine papers became creatine evidence.
 *
 * Two callers with different tolerances share this module:
 *
 * - **Triage review** (`source-identity-review.ts`) surfaces a signal for a
 *   person to check. A false "likely subject" costs one glance, so it can afford
 *   loose whitespace tokenisation of the name.
 * - **The relevance gate** accepts candidates unattended. A false match writes
 *   evidence nobody asked for and nobody will notice, so it uses `strict` terms:
 *   the full name, curated synonyms, and only those splits that genuinely mean
 *   "this intervention is either of two substances".
 *
 * The difference is `InterventionIdentityBreadth`, not two implementations.
 */

const MIN_MATCH_TERM_LENGTH = 3;

/**
 * Words that appear across many supplement names and would match papers about a
 * different intervention entirely. A term reduced to nothing but these is not an
 * identity, it is a category.
 */
export const GENERIC_MATCH_STOPWORDS = new Set([
  "acid",
  "acids",
  "and",
  "antioxidant",
  "antioxidants",
  "blend",
  "catechin",
  "catechins",
  "complex",
  "extract",
  "flavonoid",
  "flavonoids",
  "micronutrient",
  "micronutrients",
  "mineral",
  "minerals",
  "nutraceutical",
  "nutraceuticals",
  "oil",
  "phytochemical",
  "phytochemicals",
  "polyphenol",
  "polyphenols",
  "supplement",
  "supplementation",
  "vitamin"
]);

/**
 * Tokens that survive the stopword filter but are still not identities on their
 * own. These come from splitting real names — "Whey protein" yields "protein",
 * "Beta-alanine" yields "beta", "Green tea extract" yields "green" — and each
 * would match a large body of unrelated literature. Only ever excluded as a
 * standalone token; the full name and curated synonyms containing them are kept.
 */
const NON_IDENTIFYING_TOKENS = new Set([
  "beta",
  "coenzyme",
  "green",
  "hydrolyzed",
  "hydrolysed",
  "lion",
  "mane",
  "marine",
  "modified",
  "multi",
  "oral",
  "peptide",
  "peptides",
  "powder",
  "protein",
  "salt",
  "tea"
]);

export type InterventionIdentityBreadth = "strict" | "broad";

export interface InterventionIdentityInput {
  name: string;
  slug?: string;
  synonyms: string[];
}

export interface InterventionIdentityMatch {
  /** Which field the term was found in. Title is a far stronger signal. */
  field: "title" | "abstract";
  matchedTerm: string;
}

export interface InterventionIdentityTermOptions {
  breadth?: InterventionIdentityBreadth;
}

/**
 * Synonyms the seeded lists miss. These are not stylistic variants — each one is
 * the name a real body of literature uses for the intervention, so its absence
 * silently costs that evidence.
 *
 * Measured against the 12,000 accepted candidates: 33.3% did not name their
 * intervention in the title. Most were recoverable from the abstract, but the
 * entries here are the cases where neither field matched because the field used
 * a name the catalog had never heard of — "macular pigment" for lutein,
 * "n-3 PUFA" for omega-3, "epigallocatechin gallate" for green tea.
 *
 * Keyed by intervention slug. Merged with `Intervention.synonyms` rather than
 * replacing it, so curation in the database is never overwritten by code.
 */
export const INTERVENTION_SYNONYM_EXPANSIONS: Record<string, string[]> = {
  ashwagandha: ["withanolide", "withanolides", "withania"],
  astaxanthin: ["haematococcus pluvialis", "hematococcus pluvialis"],
  "beta-alanine": ["beta-alanine", "b-alanine", "carnosine loading", "muscle carnosine"],
  berberine: ["berberis", "coptis chinensis"],
  caffeine: ["trimethylxanthine", "caffeinated"],
  calcium: ["calcium supplementation", "dietary calcium", "oral calcium"],
  "coenzyme-q10": ["coenzyme q10", "co-enzyme q10", "mitoquinone"],
  collagen: ["collagen supplementation", "type ii collagen", "undenatured collagen"],
  "creatine-monohydrate": [
    "creatine monohydrate",
    "creatine supplementation",
    "creatine loading",
    "oral creatine"
  ],
  curcumin: ["turmeric", "curcuma", "curcuminoid", "bisdemethoxycurcumin"],
  "folic-acid": ["folinic acid", "levomefolate", "folate supplementation"],
  ginseng: ["ginsenoside", "ginsenosides", "panax"],
  "glucosamine-chondroitin": ["glucosamine", "chondroitin", "chondroitin sulphate"],
  glycine: ["glycine supplementation", "aminoacetic acid"],
  "green-tea-extract": [
    "epigallocatechin gallate",
    "epigallocatechin-3-gallate",
    "epigallocatechin",
    "green tea",
    "green tea catechin",
    "green tea catechins"
  ],
  "hyaluronic-acid": ["hyaluronic acid", "hyaluronate"],
  "hydrolyzed-collagen": [
    "hydrolyzed collagen",
    "hydrolysed collagen",
    "collagen peptide",
    "collagen peptides"
  ],
  iron: ["ferrous fumarate", "ferric", "iron supplementation", "oral iron"],
  "l-citrulline": ["l-citrulline", "citrulline supplementation"],
  "l-theanine": ["l-theanine", "n-ethyl-l-glutamine"],
  "lion-s-mane": ["hericium", "hericium erinaceus", "hericenone", "erinacine"],
  "lutein-and-zeaxanthin": [
    "lutein",
    "zeaxanthin",
    "meso-zeaxanthin",
    "macular pigment",
    "macular pigment optical density",
    "macular carotenoid",
    "macular carotenoids",
    "mpod"
  ],
  magnesium: ["magnesium supplementation", "magnesium threonate", "magnesium malate"],
  matcha: ["matcha"],
  melatonin: ["exogenous melatonin", "melatonin supplementation"],
  "n-acetylcysteine": ["n-acetylcysteine", "n-acetyl cysteine", "acetylcysteine"],
  "nmn-nr": ["nicotinamide mononucleotide", "nicotinamide riboside", "nad precursor"],
  "omega-3-epa-dha": [
    "omega-3",
    "omega 3 fatty acid",
    "omega-3 fatty acids",
    "n-3 pufa",
    "n-3 polyunsaturated fatty acid",
    "n-3 polyunsaturated fatty acids",
    "eicosapentaenoic acid",
    "docosahexaenoic acid",
    "icosapent ethyl",
    "marine omega-3",
    "fish oil"
  ],
  "probiotic-blend": [
    "probiotic",
    "probiotics",
    "synbiotic",
    "synbiotics",
    "lactobacillus",
    "bifidobacterium",
    "lactic acid bacteria",
    "saccharomyces boulardii"
  ],
  // "Psilocybe" is the genus the compound is extracted from, so a paper naming
  // it is about this intervention. "Classic psychedelic" is not — that is a
  // class covering LSD and DMT, and it stays out.
  psilocybin: ["psilocin", "psilocybin-assisted", "psilocybe"],
  psyllium: ["plantago ovata", "psyllium husk", "ispaghula husk"],
  quercetin: ["quercetin supplementation", "isoquercetin"],
  resveratrol: ["trans-resveratrol", "resveratrol supplementation"],
  // Deliberately no "GLP-1 receptor agonist" here. It is a drug class, not this
  // drug, and a class-wide meta-analysis is not semaglutide evidence. The
  // seeded synonyms already carry it; this table does not add to that reach.
  semaglutide: ["ozempic", "wegovy"],
  taurine: ["taurine supplementation"],
  "tongkat-ali": ["eurycoma", "eurycoma longifolia", "eurycomanone"],
  "trimethylglycine-tmg": ["betaine", "glycine betaine", "betaine supplementation"],
  "vitamin-b12": [
    "vitamin b12",
    "hydroxocobalamin",
    "adenosylcobalamin",
    "mecobalamin",
    "cobalamin"
  ],
  "vitamin-c": ["ascorbate", "ascorbic acid", "sodium ascorbate"],
  "vitamin-d": ["vitamin d3", "vitamin d2", "calcifediol", "calcitriol", "25-hydroxyvitamin d"],
  "whey-protein": ["whey", "whey isolate", "whey supplementation"],
  zinc: ["zinc supplementation", "zinc sulfate", "zinc sulphate", "oral zinc"]
};

/**
 * Splits a name only where the separator means "either of these substances":
 * "Lutein and Zeaxanthin", "Glucosamine/chondroitin", "Trimethylglycine (TMG)".
 *
 * Deliberately does NOT split on whitespace. "Whey protein" is one substance;
 * splitting it produces "protein", which matches most of the nutrition
 * literature. Whitespace tokens are `broad` breadth only.
 */
function compoundNameParts(name: string): string[] {
  return name
    .split(/\s*[/,]\s*|\s+and\s+|[()]/gi)
    .map((part) => normaliseForMatch(part))
    .filter((part) => part.length > 0);
}

/**
 * Literature writes the same name several ways, and the differences are all
 * punctuation: `vitamin B12`, `vitamin B-12` and `vitamin B(12)`; `omega-3` and
 * `omega 3`; `GLP-1` and `GLP 1`. Separating letter runs from digit runs makes
 * every one of them normalise to the same string, so a term written one way
 * still matches a paper that wrote it another.
 *
 * Applied to both sides, so it cannot introduce a mismatch of its own.
 */
/**
 * Papers write Greek letters as the letter; catalogs write them out. Stripping
 * them as punctuation turns "β-Alanine" into "alanine", which matches neither
 * "beta alanine" nor anything else useful — the intervention disappears from its
 * own paper. Transliterating keeps both spellings on the same footing.
 */
const GREEK_TRANSLITERATIONS: Record<string, string> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ω: "omega",
  τ: "tau"
};

export function normaliseForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[αβγδεκλμωτ]/g, (letter) => ` ${GREEK_TRANSLITERATIONS[letter]} `)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function usableTerm(term: string): boolean {
  return term.length >= MIN_MATCH_TERM_LENGTH && !GENERIC_MATCH_STOPWORDS.has(term);
}

/**
 * Every string that, found on a word boundary, means the text is about this
 * intervention. Longest first, so a reported match names the most specific term
 * that fired rather than an incidental fragment of it.
 */
export function interventionIdentityTerms(
  intervention: InterventionIdentityInput,
  options: InterventionIdentityTermOptions = {}
): string[] {
  const breadth = options.breadth ?? "strict";
  const curated = intervention.slug
    ? (INTERVENTION_SYNONYM_EXPANSIONS[intervention.slug] ?? [])
    : [];
  const named = [intervention.name, ...intervention.synonyms, ...curated];
  const terms = new Set<string>();

  for (const value of named) {
    const whole = normaliseForMatch(value);

    if (usableTerm(whole)) {
      terms.add(whole);
    }

    for (const part of compoundNameParts(value)) {
      if (usableTerm(part) && !NON_IDENTIFYING_TOKENS.has(part)) {
        terms.add(part);
      }
    }
  }

  if (breadth === "broad") {
    // Triage breadth: every meaningful whitespace token as well. Produces
    // matches a person is expected to check, never ones acted on unattended.
    for (const value of named) {
      for (const token of normaliseForMatch(value).split(" ")) {
        if (usableTerm(token)) {
          terms.add(token);
        }
      }
    }
  }

  return [...terms].sort((left, right) => right.length - left.length);
}

/**
 * Word-boundary containment, not substring. `includes()` is precisely the bug
 * this module exists to prevent: "creatine" is a substring of "creatinine",
 * "phosphocreatine" and "creatine kinase", and matching that way is how a
 * statin-myopathy trial became creatine evidence.
 */
export function containsIdentityTerm(haystack: string, term: string): boolean {
  // A trailing plural is tolerated because catalogs store the singular and
  // papers use whichever reads better: "GLP-1 receptor agonist" has to match a
  // review of "GLP-1 receptor agonists". Only the plural suffix is optional —
  // the boundary either side is still required, so this does not reopen the
  // substring hole.
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(term)}(?:e?s)?(?:$|[^a-z0-9])`,
    "i"
  );

  return pattern.test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface FindInterventionIdentityMatchInput {
  abstract?: string | null;
  breadth?: InterventionIdentityBreadth;
  intervention: InterventionIdentityInput;
  title?: string | null;
}

/**
 * Looks in the title first. A title naming the intervention is near-proof it is
 * the subject; an abstract naming it may only be citing it as background, so the
 * caller is told which field matched and can weigh them differently.
 */
export function findInterventionIdentityMatch({
  abstract,
  breadth = "strict",
  intervention,
  title
}: FindInterventionIdentityMatchInput): InterventionIdentityMatch | undefined {
  const terms = interventionIdentityTerms(intervention, { breadth });
  const normalisedTitle = normaliseForMatch(title ?? "");
  const normalisedAbstract = normaliseForMatch(abstract ?? "");

  for (const term of terms) {
    if (containsIdentityTerm(normalisedTitle, term)) {
      return { field: "title", matchedTerm: term };
    }
  }

  for (const term of terms) {
    if (containsIdentityTerm(normalisedAbstract, term)) {
      return { field: "abstract", matchedTerm: term };
    }
  }

  return undefined;
}
