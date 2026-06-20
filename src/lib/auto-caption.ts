"use client";

/**
 * Client-side image auto-captioning using transformers.js + ResNet-50.
 *
 * Why ResNet-50?
 *   - Small (~25MB quantized ONNX)
 *   - Fast inference (~200-500ms after model loads)
 *   - 1000 ImageNet classes covering common subjects (animals, people,
 *     vehicles, objects, food, landscapes, etc.)
 *   - Runs entirely in the browser — no API key, no server, no rate limits
 *
 * The detected label (e.g. "beagle", "golden retriever", "sports car")
 * is used as the subjectHint for Pollinations generation, so the user
 * doesn't need to manually pick or type a subject.
 *
 * Model files are downloaded from huggingface.co on first use and cached
 * by the browser. Subsequent loads are instant.
 */

import type { ImageClassificationPipeline } from "@huggingface/transformers";

let pipelineInstance: ImageClassificationPipeline | null = null;
let pipelinePromise: Promise<ImageClassificationPipeline> | null = null;
let lastStatus: "idle" | "loading" | "ready" | "error" = "idle";
const statusListeners = new Set<(s: typeof lastStatus) => void>();

export type CaptionStatus = typeof lastStatus;

export function getCaptionStatus(): CaptionStatus {
  return lastStatus;
}

export function onCaptionStatusChange(
  cb: (s: CaptionStatus) => void
): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

function setStatus(s: CaptionStatus) {
  lastStatus = s;
  statusListeners.forEach((cb) => cb(s));
}

async function getPipeline(): Promise<ImageClassificationPipeline> {
  if (pipelineInstance) return pipelineInstance;
  if (pipelinePromise) return pipelinePromise;

  setStatus("loading");
  pipelinePromise = (async () => {
    // Dynamic import — keeps initial page load fast and avoids loading
    // the transformers.js library unless auto-captioning is actually used.
    const { pipeline, env } = await import("@huggingface/transformers");

    // Allow remote model downloads from Hugging Face CDN, and cache them
    // in the browser for offline-ish subsequent loads.
    env.allowLocalModels = false;
    env.allowRemoteModels = true;

    const classifier = await pipeline(
      "image-classification",
      "Xenova/resnet-50",
      { device: "wasm" }
    );
    pipelineInstance = classifier as unknown as ImageClassificationPipeline;
    setStatus("ready");
    return pipelineInstance;
  })();

  try {
    return await pipelinePromise;
  } catch (err) {
    setStatus("error");
    pipelinePromise = null;
    throw err;
  }
}

export interface CaptionResult {
  /** Top predicted label (e.g. "beagle", "golden retriever", "sports car"). */
  label: string;
  /** Confidence score 0-1. */
  score: number;
  /** Human-friendly subject hint built from the label (e.g. "a beagle dog"). */
  subjectHint: string;
  /** Top 5 predictions for debugging. */
  top5: Array<{ label: string; score: number }>;
}

/**
 * Map an ImageNet class label to a subject hint suitable for Pollinations.
 *
 * ImageNet labels can be:
 *   - Single nouns: "cat", "dog", "car"
 *   - Compound: "golden retriever", "sports car", "espresso"
 *   - Multi-word with commas: "bloodhound, sleuthhound"
 *
 * This function normalizes them into "a/an <subject>" format.
 */
function labelToSubjectHint(label: string): string {
  // Take the first variant if label has commas (e.g. "bloodhound, sleuthhound")
  const primary = label.split(",")[0].trim();

  // Map specific ImageNet labels to more descriptive subject phrases
  const labelMap: Record<string, string> = {
    // Dogs
    beagle: "a beagle dog",
    "golden retriever": "a golden retriever dog",
    "labrador retriever": "a labrador dog",
    "german shepherd": "a german shepherd dog",
    "siberian husky": "a husky dog",
    poodle: "a poodle dog",
    chihuahua: "a chihuahua dog",
    pug: "a pug dog",
    "border collie": "a border collie dog",
    "standard poodle": "a poodle dog",
    "miniature poodle": "a poodle dog",
    "toy poodle": "a poodle dog",
    dalmatian: "a dalmatian dog",
    "affenpinscher": "a small dog",
    "bernese mountain dog": "a bernese mountain dog",
    "greater swiss mountain dog": "a mountain dog",
    "kuvasz": "a large white dog",
    "old english sheepdog": "a sheepdog",
    "shetland sheepdog": "a sheltie dog",
    collie: "a collie dog",
    "walker hound": "a hound dog",
    "english foxhound": "a foxhound dog",
    "bloodhound": "a bloodhound dog",
    "blenheim spaniel": "a small spaniel dog",
    "welsh springer spaniel": "a spaniel dog",
    "cocker spaniel": "a cocker spaniel dog",
    "clumber spaniel": "a clumber spaniel dog",
    "brittany spaniel": "a brittany spaniel dog",
    "irish setter": "an irish setter dog",
    "gordon setter": "a gordon setter dog",
    "english setter": "an english setter dog",

    // Cats
    "tabby cat": "a tabby cat",
    "tiger cat": "a tiger-striped cat",
    "persian cat": "a persian cat",
    "siamese cat": "a siamese cat",
    "egyptian cat": "an egyptian cat",
    "lynx": "a lynx cat",

    // Birds
    "cock": "a rooster bird",
    hen: "a hen bird",
    ostrich: "an ostrich bird",
    brambling: "a small bird",
    "gold finch": "a goldfinch bird",
    "house finch": "a house finch bird",
    junco: "a junco bird",
    "indigo bunting": "a small blue bird",
    robin: "a robin bird",
    bulbul: "a small bird",
    "magpie": "a magpie bird",
    "water ouzel": "a water bird",

    // Other animals
    fox: "a fox",
    "grey fox": "a grey fox",
    "arctic fox": "an arctic fox",
    "red fox": "a red fox",
    wolf: "a wolf",
    "timber wolf": "a timber wolf",
    "white wolf": "a white wolf",
    coyote: "a coyote",
    hyena: "a hyena",
    lion: "a lion",
    tiger: "a tiger",
    jaguar: "a jaguar",
    leopard: "a leopard",
    cheetah: "a cheetah",
    "snow leopard": "a snow leopard",
    cougar: "a cougar",
    bear: "a bear",
    "brown bear": "a brown bear",
    "ice bear": "a polar bear",
    "american black bear": "a black bear",
    "sloth bear": "a sloth bear",
    "mongoose": "a mongoose",
    "weasel": "a weasel",
    "black-footed ferret": "a ferret",
    "otter": "an otter",
    "skunk": "a skunk",
    "badger": "a badger",
    "armadillo": "an armadillo",
    "raccoon": "a raccoon",
    "colobus monkey": "a monkey",
    "gorilla": "a gorilla",
    "chimpanzee": "a chimpanzee",
    "orangutan": "an orangutan",
    "siamang": "a gibbon",
    "gibbon": "a gibbon",
    "spider monkey": "a spider monkey",
    "guenon": "a monkey",
    "macaque": "a macaque monkey",
    "langur": "a langur monkey",
    "baboon": "a baboon",
    "lesser panda": "a red panda",
    "giant panda": "a giant panda",
    "zebra": "a zebra",
    "horse": "a horse",
    "sorrel": "a sorrel horse",
    "arabian camel": "a camel",
    "ox": "an ox",
    "water buffalo": "a water buffalo",
    "bison": "a bison",
    "ram": "a ram",
    "ibex": "an ibex",
    "hartebeest": "a hartebeest",
    "impala": "an impala",
    "gazelle": "a gazelle",
    "guinea pig": "a guinea pig",
    "hamster": "a hamster",
    "porcupine": "a porcupine",
    "fox squirrel": "a squirrel",
    "chipmunk": "a chipmunk",
    "marmot": "a marmot",
    "beaver": "a beaver",
    "rabbit": "a rabbit",
    "hare": "a hare",
    "wood rabbit": "a wood rabbit",
    "wallaby": "a wallaby",
    "koala": "a koala",
    "wombat": "a wombat",

    // Vehicles
    "sports car": "a sports car",
    "convertible": "a convertible car",
    "limousine": "a limousine car",
    "jeep": "a jeep",
    "minivan": "a minivan",
    "cab": "a taxi cab",
    "police van": "a police van",
    "snowplow": "a snowplow truck",
    "fire engine": "a fire engine",
    "ambulance": "an ambulance",
    "tow truck": "a tow truck",
    "garbage truck": "a garbage truck",
    "pickup": "a pickup truck",
    "trailer truck": "a trailer truck",
    "moving van": "a moving van",
    "forklift": "a forklift",
    "electric locomotive": "an electric train",
    "steam locomotive": "a steam train",
    "passenger car": "a train passenger car",
    "freight car": "a freight train car",
    "bullet train": "a bullet train",
    "trolleybus": "a trolleybus",
    "streetcar": "a streetcar",

    // Aircraft / watercraft
    "airliner": "an airliner plane",
    "warplane": "a warplane",
    "space shuttle": "a space shuttle",
    "airplane": "an airplane",
    "canoe": "a canoe",
    "catamaran": "a catamaran boat",
    "trimaran": "a trimaran boat",
    "gondola": "a gondola boat",
    "sailboat": "a sailboat",
    "speedboat": "a speedboat",
    "fireboat": "a fireboat",
    "lifeboat": "a lifeboat",
    "paddlewheel": "a paddlewheel boat",
    "dock": "a dock",

    // Food
    pizza: "a pizza",
    "pizza": "a pizza",
    "cheeseburger": "a cheeseburger",
    "hamburger": "a hamburger",
    "hotdog": "a hot dog",
    "french fries": "french fries",
    "plate": "a plate of food",
    "espresso": "an espresso coffee",
    "cup": "a cup of coffee",
    "eggnog": "eggnog",
    "red wine": "a glass of red wine",
    "guacamole": "guacamole",
    "burrito": "a burrito",
    "pretzel": "a pretzel",
    "ice cream": "ice cream",
    "ice lolly": "an ice lolly",
    "bagel": "a bagel",
    "french loaf": "a french loaf bread",
    "dough": "dough",
    "mushroom": "a mushroom",
    "banana": "a banana",
    "pineapple": "a pineapple",
    "lemon": "a lemon",
    "orange": "an orange",
    "strawberry": "a strawberry",
    "fig": "a fig",
    "pomegranate": "a pomegranate",
    "custard apple": "a custard apple",
    "cardoon": "a cardoon vegetable",
    "bell pepper": "a bell pepper",
    "cauliflower": "a cauliflower",
    "zucchini": "a zucchini",
    "spaghetti squash": "a spaghetti squash",
    "acorn squash": "an acorn squash",
    "butternut squash": "a butternut squash",
    "cucumber": "a cucumber",
    "artichoke": "an artichoke",
    "head cabbage": "a head of cabbage",
    "broccoli": "broccoli",
    "corn": "corn",
    "ear": "an ear of corn",

    // Objects / furniture / household
    "studio couch": "a studio couch",
    "folding chair": "a folding chair",
    "rocking chair": "a rocking chair",
    "throne": "a throne",
    "barbershop chair": "a barbershop chair",
    "four-poster": "a four-poster bed",
    "bookcase": "a bookcase",
    "china cabinet": "a china cabinet",
    "file": "a file cabinet",
    "wardrobe": "a wardrobe",
    "table lamp": "a table lamp",
    "candle": "a candle",
    "lampshade": "a lampshade",
    "grand piano": "a grand piano",
    "upright piano": "an upright piano",
    "acoustic guitar": "an acoustic guitar",
    "electric guitar": "an electric guitar",
    "banjo": "a banjo",
    "cello": "a cello",
    "violin": "a violin",
    "harp": "a harp",
    "flute": "a flute",
    "organ": "an organ",
    "harpsichord": "a harpsichord",
    "drum": "a drum",
    "maraca": "a maraca",
    "steel drum": "a steel drum",

    // Other
    "kimono": "a kimono",
    "suit": "a suit",
    "gown": "a gown",
    "academic gown": "an academic gown",
    "maillot": "a swimwear",
    "bikini": "a bikini",
    "jean": "jeans",
    "miniskirt": "a miniskirt",
    "cowboy hat": "a cowboy hat",
    "bonnet": "a bonnet hat",
    "mortarboard": "a graduation cap",
    "shower cap": "a shower cap",
    "teddy bear": "a teddy bear",
    " soccer ball": "a soccer ball",
    "volleyball": "a volleyball",
    "rugby ball": "a rugby ball",
    "billiard table": "a billiard table",
    "parallel bars": "parallel bars",
    "horizontal bar": "a horizontal bar",
  };

  if (labelMap[primary.toLowerCase()]) {
    return labelMap[primary.toLowerCase()];
  }

  // Generic fallback: prepend "a" (or "an" if starts with vowel)
  const startsWithVowel = /^[aeiou]/i.test(primary);
  return `${startsWithVowel ? "an" : "a"} ${primary}`;
}

/**
 * Auto-caption an image and return a subject hint.
 *
 * @param imageEl An HTMLImageElement (or any image-like object transformers.js accepts)
 * @returns CaptionResult with top label + subject hint
 */
export async function autoCaptionImage(
  imageEl: HTMLImageElement
): Promise<CaptionResult> {
  const classifier = await getPipeline();
  const output = (await classifier(imageEl, { topk: 5 })) as Array<{
    label: string;
    score: number;
  }>;

  const top5 = Array.isArray(output) ? output : [output];
  const top = top5[0];

  return {
    label: top.label,
    score: top.score,
    subjectHint: labelToSubjectHint(top.label),
    top5,
  };
}

/**
 * Convenience wrapper: classify an image from a data URL.
 * Internally creates a temporary <img> element.
 */
export async function autoCaptionDataUrl(
  dataUrl: string
): Promise<CaptionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const result = await autoCaptionImage(img);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for captioning"));
    img.src = dataUrl;
  });
}
