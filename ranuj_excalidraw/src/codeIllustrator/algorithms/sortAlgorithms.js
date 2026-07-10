import { baseFrame } from "../frameBase";

function sortFrame(name, values, centerX, subtitle, options = {}) {
  const codeLines = options.codeLines || ["for each pass:", "compare values", "swap / move when required", "answer becomes sorted"];
  return baseFrame({ name, title: options.title || "Sorting Illustrator", subtitle, centerX, codeLines, activeLine: options.activeLine ?? 1, values, arrayOptions: { active: options.activeIndexes || [], sorted: options.sortedIndexes || [], label: "array" }, variables: options.variables || [], note: options.note || "Sorting dry run." });
}

export function bubbleSortFrames(numbers, centerX, title) {
  const arr = [...numbers]; const frames = [sortFrame("Input", arr, centerX, `Bubble sort input [${arr.join(", ")}]`, { title, activeLine: 0 })];
  const n = arr.length;
  for (let i = 0; i < n - 1; i += 1) for (let j = 0; j < n - i - 1; j += 1) {
    frames.push(sortFrame(`Compare ${j},${j + 1}`, arr, centerX, `Compare ${arr[j]} and ${arr[j + 1]}`, { title, activeIndexes: [j, j + 1], sortedIndexes: Array.from({ length: i }, (_, k) => n - 1 - k), variables: [{ label: "i", value: i }, { label: "j", value: j }] }));
    if (arr[j] > arr[j + 1]) { [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]]; frames.push(sortFrame(`Swap ${j},${j + 1}`, arr, centerX, "Swap because left value is bigger.", { title, activeLine: 2, activeIndexes: [j, j + 1], sortedIndexes: Array.from({ length: i }, (_, k) => n - 1 - k), variables: [{ label: "swapped", value: "yes" }] })); }
  }
  frames.push(sortFrame("Sorted", arr, centerX, `Sorted array [${arr.join(", ")}]`, { title, activeLine: 3, sortedIndexes: arr.map((_, i) => i), variables: [{ label: "answer", value: `[${arr.join(", ")}]`, bold: true }] }));
  return frames.slice(0, 80);
}

export function selectionSortFrames(numbers, centerX, title) {
  const arr = [...numbers]; const frames = [sortFrame("Input", arr, centerX, `Selection sort input [${arr.join(", ")}]`, { title })];
  for (let i = 0; i < arr.length - 1; i += 1) { let min = i; for (let j = i + 1; j < arr.length; j += 1) { frames.push(sortFrame(`Find min ${i}:${j}`, arr, centerX, `Compare min ${arr[min]} with ${arr[j]}`, { title, activeIndexes: [min, j], sortedIndexes: Array.from({ length: i }, (_, k) => k), variables: [{ label: "minIndex", value: min }, { label: "j", value: j }] })); if (arr[j] < arr[min]) min = j; } if (min !== i) [arr[i], arr[min]] = [arr[min], arr[i]]; frames.push(sortFrame(`Place min ${i}`, arr, centerX, `Place minimum at index ${i}`, { title, activeLine: 2, activeIndexes: [i], sortedIndexes: Array.from({ length: i + 1 }, (_, k) => k), variables: [{ label: "minIndex", value: min }] })); }
  frames.push(sortFrame("Sorted", arr, centerX, `Sorted array [${arr.join(", ")}]`, { title, sortedIndexes: arr.map((_, i) => i) })); return frames.slice(0, 80);
}

export function insertionSortFrames(numbers, centerX, title) {
  const arr = [...numbers]; const frames = [sortFrame("Input", arr, centerX, `Insertion sort input [${arr.join(", ")}]`, { title })];
  for (let i = 1; i < arr.length; i += 1) { const key = arr[i]; let j = i - 1; frames.push(sortFrame(`Key ${key}`, arr, centerX, `Take key ${key}`, { title, activeIndexes: [i], sortedIndexes: Array.from({ length: i }, (_, k) => k), variables: [{ label: "key", value: key }] })); while (j >= 0 && arr[j] > key) { arr[j + 1] = arr[j]; frames.push(sortFrame(`Shift ${j}`, arr, centerX, `Shift ${arr[j]} right`, { title, activeLine: 2, activeIndexes: [j, j + 1], variables: [{ label: "key", value: key }] })); j -= 1; } arr[j + 1] = key; frames.push(sortFrame(`Insert ${key}`, arr, centerX, `Insert key at ${j + 1}`, { title, activeIndexes: [j + 1], sortedIndexes: Array.from({ length: i + 1 }, (_, k) => k) })); }
  frames.push(sortFrame("Sorted", arr, centerX, `Sorted array [${arr.join(", ")}]`, { title, sortedIndexes: arr.map((_, i) => i) })); return frames.slice(0, 80);
}

export function quickSortFrames(numbers, centerX, title) {
  const arr = [...numbers]; const frames = [sortFrame("Input", arr, centerX, `Quick sort input [${arr.join(", ")}]`, { title })];
  function partition(low, high) { const pivot = arr[high]; let i = low - 1; frames.push(sortFrame(`Pivot ${pivot}`, arr, centerX, `Pivot=${pivot} at ${high}`, { title, activeIndexes: [high], variables: [{ label: "low/high", value: `${low}/${high}` }, { label: "pivot", value: pivot }] })); for (let j = low; j < high && frames.length < 75; j += 1) { frames.push(sortFrame(`Compare pivot ${j}`, arr, centerX, `Compare ${arr[j]} <= ${pivot}`, { title, activeIndexes: [j, high], variables: [{ label: "i", value: i }, { label: "j", value: j }] })); if (arr[j] <= pivot) { i += 1; [arr[i], arr[j]] = [arr[j], arr[i]]; frames.push(sortFrame(`Move ${j}`, arr, centerX, "Move into <= pivot side", { title, activeIndexes: [i, j] })); } } [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]; frames.push(sortFrame("Place pivot", arr, centerX, `Pivot placed at ${i + 1}`, { title, activeIndexes: [i + 1], sortedIndexes: [i + 1] })); return i + 1; }
  function sort(low, high) { if (low < high && frames.length < 76) { const p = partition(low, high); sort(low, p - 1); sort(p + 1, high); } }
  sort(0, arr.length - 1); frames.push(sortFrame("Sorted", arr, centerX, `Sorted array [${arr.join(", ")}]`, { title, sortedIndexes: arr.map((_, i) => i) })); return frames.slice(0, 80);
}
