import { DEFAULT_NUMBERS, MAX_ITEMS } from "./constants";
import { inferProblemType, parseCodeIllustratorNumbers } from "./parser";
import { maxSubarrayFrames, prefixSumFrames, twoSumFrames, binarySearchFrames, slidingWindowFrames } from "./algorithms/arrayAlgorithms";
import { arrayMaxFrames, dutchFlagFrames, moveZerosFrames, removeDuplicatesFrames, reverseArrayFrames } from "./algorithms/arrayBuilder";
import { bubbleSortFrames, insertionSortFrames, quickSortFrames, selectionSortFrames } from "./algorithms/sortAlgorithms";
import { genericListFrames } from "./algorithms/genericList";
import { duplicateArrayFrames, hashMapFrames, hashSetFrames, priorityQueueFrames, queueFrames, stackFrames, variablesFrames } from "./algorithms/dataStructures";
import { systemDesignFoundationFrames } from "./systemDesignFoundations";

export { parseCodeIllustratorNumbers };

export function buildCodeIllustrationFrames({ algorithm = "bubble", problemType = "auto", code = "", numbers = [], centerX = 600, title } = {}) {
  const safeNumbers = (Array.isArray(numbers) && numbers.length ? numbers : DEFAULT_NUMBERS).slice(0, MAX_ITEMS);
  const type = inferProblemType({ problemType, code, algorithm });
  const safeTitle = title || "Code Illustrator";
  if (type === "systemDesignFoundation") return systemDesignFoundationFrames();
  if (type === "maxSubarray") return maxSubarrayFrames(safeNumbers, centerX, safeTitle).slice(0, 80);
  if (type === "prefixSum") return prefixSumFrames(safeNumbers, centerX, safeTitle).slice(0, 80);
  if (type === "twoSum") return twoSumFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "binarySearch") return binarySearchFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "slidingWindow") return slidingWindowFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "dutchFlag") return dutchFlagFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "moveZeros") return moveZerosFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "removeDuplicates") return removeDuplicatesFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "reverseArray") return reverseArrayFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "arrayMax") return arrayMaxFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "genericList") return genericListFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "hashSet") return hashSetFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "hashMap") return hashMapFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "duplicates") return duplicateArrayFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "stack") return stackFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "queue") return queueFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "priorityQueue") return priorityQueueFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "variables") return variablesFrames(safeNumbers, centerX, safeTitle, code).slice(0, 80);
  if (type === "selection") return selectionSortFrames(safeNumbers, centerX, safeTitle);
  if (type === "insertion") return insertionSortFrames(safeNumbers, centerX, safeTitle);
  if (type === "quick") return quickSortFrames(safeNumbers, centerX, safeTitle);
  return bubbleSortFrames(safeNumbers, centerX, safeTitle);
}
