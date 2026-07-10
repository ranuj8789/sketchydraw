import { baseFrame, rangeIndexes } from "../frameBase";
import { parseTargetFromCode, parseWindowSizeFromCode } from "../parser";

export function maxSubarrayFrames(numbers, centerX, title) {
  const arr = [...numbers];
  const codeLines = ["currentSum = arr[0]", "maxSum = arr[0]", "for i from 1 to n-1:", "currentSum = max(arr[i], currentSum + arr[i])", "maxSum = max(maxSum, currentSum)", "return maxSum"];
  const frames = [];
  let currentSum = arr[0], maxSum = arr[0], bestStart = 0, bestEnd = 0, tempStart = 0;
  frames.push(baseFrame({ name: "Input", title: title || "Maximum Subarray", subtitle: `Find maximum sum contiguous subarray for [${arr.join(", ")}]`, centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { active: [0], label: "array" }, variables: [{ label: "currentSum", value: currentSum, bold: true }, { label: "maxSum", value: maxSum, bold: true }], note: "Start with first element." }));
  for (let i = 1; i < arr.length; i += 1) {
    const extend = currentSum + arr[i], restart = arr[i], useRestart = restart > extend;
    currentSum = useRestart ? restart : extend;
    if (useRestart) tempStart = i;
    frames.push(baseFrame({ name: `Index ${i}: choose sum`, title: title || "Maximum Subarray", subtitle: `Choose max(${restart}, ${extend}) at i=${i}`, centerX, codeLines, activeLine: 3, values: arr, arrayOptions: { active: [i], left: Array.from({ length: i }, (_, k) => k), label: "array" }, variables: [{ label: "arr[i]", value: restart, bold: true }, { label: "extend", value: extend }, { label: "currentSum", value: currentSum, bold: true }], note: useRestart ? "Restart subarray here." : "Extend previous subarray." }));
    if (currentSum > maxSum) {
      maxSum = currentSum; bestStart = tempStart; bestEnd = i;
      frames.push(baseFrame({ name: `New max at ${i}`, title: title || "Maximum Subarray", subtitle: `New answer found: maxSum = ${maxSum}`, centerX, codeLines, activeLine: 4, values: arr, arrayOptions: { active: [i], sorted: rangeIndexes(bestStart, bestEnd), label: "best subarray" }, variables: [{ label: "currentSum", value: currentSum }, { label: "maxSum", value: maxSum, bold: true, stroke: "#16a34a", fill: "rgba(22,163,74,0.14)" }], note: `Best range is ${bestStart}..${bestEnd}.` }));
    }
  }
  frames.push(baseFrame({ name: "Answer", title: title || "Maximum Subarray", subtitle: `Answer maxSum = ${maxSum}, subarray = [${arr.slice(bestStart, bestEnd + 1).join(", ")}]`, centerX, codeLines, activeLine: 5, values: arr, arrayOptions: { sorted: rangeIndexes(bestStart, bestEnd), label: "answer" }, variables: [{ label: "maxSum", value: maxSum, bold: true }, { label: "range", value: `${bestStart}..${bestEnd}` }], note: "Kadane dry run complete." }));
  return frames;
}

export function prefixSumFrames(numbers, centerX, title) {
  const arr = [...numbers], prefix = [];
  const codeLines = ["sum = 0", "for i from 0 to n-1:", "sum = sum + arr[i]", "prefix[i] = sum", "return prefix"];
  const frames = [baseFrame({ name: "Input", title: title || "Prefix Sum", subtitle: `Build prefix sum for [${arr.join(", ")}]`, centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "array" }, variables: [{ label: "sum", value: 0 }], note: "Start cumulative sum at zero." })];
  let sum = 0;
  arr.forEach((value, i) => { sum += value; prefix[i] = sum; frames.push(baseFrame({ name: `Prefix index ${i}`, title: title || "Prefix Sum", subtitle: `prefix[${i}] = ${sum}`, centerX, codeLines, activeLine: 2, values: arr, arrayOptions: { active: [i], sorted: Array.from({ length: i + 1 }, (_, k) => k), label: "array" }, variables: [{ label: "sum", value: sum, bold: true }, { label: "prefix", value: `[${prefix.join(", ")}]` }], note: "Store cumulative sum." })); });
  frames.push(baseFrame({ name: "Answer", title: title || "Prefix Sum", subtitle: `Answer prefix = [${prefix.join(", ")}]`, centerX, codeLines, activeLine: 4, values: prefix, arrayOptions: { sorted: prefix.map((_, i) => i), label: "prefix" }, variables: [{ label: "prefix", value: `[${prefix.join(", ")}]`, bold: true }], note: "Range sum becomes prefix[r] - prefix[l-1]." }));
  return frames;
}

export function twoSumFrames(numbers, centerX, title, code) {
  const arr = [...numbers];
  const target = parseTargetFromCode(code, arr[0] + arr[1]);
  const codeLines = ["map = {}", "for i from 0 to n-1:", "need = target - arr[i]", "if need in map: return [map[need], i]", "map[arr[i]] = i"];
  const map = new Map();
  const frames = [baseFrame({ name: "Input", title: title || "Two Sum", subtitle: `Find target = ${target}`, centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "array" }, variables: [{ label: "target", value: target }, { label: "map", value: "{}" }], note: "HashMap stores value → index." })];
  for (let i = 0; i < arr.length; i += 1) {
    const need = target - arr[i];
    frames.push(baseFrame({ name: `Check ${i}`, title: title || "Two Sum", subtitle: `need = ${target} - ${arr[i]} = ${need}`, centerX, codeLines, activeLine: 2, values: arr, arrayOptions: { active: [i], sorted: Array.from({ length: i }, (_, k) => k), label: "array" }, variables: [{ label: "target", value: target }, { label: "need", value: need, bold: true }, { label: "map", value: `{${Array.from(map.entries()).map(([k, v]) => `${k}:${v}`).join(", ")}}` }], note: "Check if need already exists." }));
    if (map.has(need)) { frames.push(baseFrame({ name: "Answer", title: title || "Two Sum", subtitle: `Found indexes [${map.get(need)}, ${i}]`, centerX, codeLines, activeLine: 3, values: arr, arrayOptions: { active: [map.get(need), i], sorted: [map.get(need), i], label: "answer pair" }, variables: [{ label: "answer", value: `[${map.get(need)}, ${i}]`, bold: true }], note: `${need} was already in HashMap.` })); return frames; }
    map.set(arr[i], i);
  }
  frames.push(baseFrame({ name: "No pair", title: title || "Two Sum", subtitle: "No pair found", centerX, codeLines, activeLine: 4, values: arr, arrayOptions: { label: "array" }, variables: [{ label: "answer", value: "not found" }], note: "Try target = 9 in code." }));
  return frames;
}

export function binarySearchFrames(numbers, centerX, title, code) {
  const arr = [...numbers].sort((a, b) => a - b); const target = parseTargetFromCode(code, arr[Math.floor(arr.length / 2)]);
  const codeLines = ["left = 0, right = n - 1", "while left <= right:", "mid = floor((left + right) / 2)", "if arr[mid] == target: return mid", "if arr[mid] < target: left = mid + 1", "else: right = mid - 1"];
  const frames = []; let left = 0, right = arr.length - 1;
  frames.push(baseFrame({ name: "Input", title: title || "Binary Search", subtitle: `Search ${target} in sorted array`, centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { left: [left], right: [right], label: "sorted array" }, variables: [{ label: "target", value: target }, { label: "left/right", value: `${left}/${right}` }], note: "Array is sorted first." }));
  while (left <= right && frames.length < 30) {
    const mid = Math.floor((left + right) / 2);
    frames.push(baseFrame({ name: `Mid ${mid}`, title: title || "Binary Search", subtitle: `mid=${mid}, arr[mid]=${arr[mid]}`, centerX, codeLines, activeLine: 2, values: arr, arrayOptions: { active: [mid], left: [left], right: [right], label: "search range" }, variables: [{ label: "left", value: left }, { label: "mid", value: mid, bold: true }, { label: "right", value: right }, { label: "target", value: target }], note: "Purple = left, blue = right, orange = mid." }));
    if (arr[mid] === target) { frames.push(baseFrame({ name: "Found", title: title || "Binary Search", subtitle: `Found at index ${mid}`, centerX, codeLines, activeLine: 3, values: arr, arrayOptions: { active: [mid], sorted: [mid], label: "answer" }, variables: [{ label: "answer", value: mid, bold: true }], note: "Return mid." })); return frames; }
    if (arr[mid] < target) left = mid + 1; else right = mid - 1;
  }
  frames.push(baseFrame({ name: "Not found", title: title || "Binary Search", subtitle: `Target ${target} not found`, centerX, codeLines, activeLine: 1, values: arr, arrayOptions: { label: "array" }, variables: [{ label: "answer", value: -1 }], note: "Search range empty." }));
  return frames;
}

export function slidingWindowFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const k = Math.min(arr.length, parseWindowSizeFromCode(code, 3));
  const codeLines = ["windowSum = sum(first k)", "best = windowSum", "for right from k to n-1:", "windowSum += arr[right] - arr[right-k]", "best = max(best, windowSum)", "return best"];
  const frames = []; let windowSum = arr.slice(0, k).reduce((a, b) => a + b, 0); let best = windowSum;
  frames.push(baseFrame({ name: "First window", title: title || "Sliding Window", subtitle: `Maximum sum, k=${k}`, centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { active: Array.from({ length: k }, (_, i) => i), label: "first window" }, variables: [{ label: "k", value: k }, { label: "windowSum", value: windowSum }, { label: "best", value: best }], note: "Compute first window." }));
  for (let right = k; right < arr.length; right += 1) { const leftOut = right - k; windowSum += arr[right] - arr[leftOut]; best = Math.max(best, windowSum); frames.push(baseFrame({ name: `Window to ${right}`, title: title || "Sliding Window", subtitle: `Add arr[${right}], remove arr[${leftOut}]`, centerX, codeLines, activeLine: 3, values: arr, arrayOptions: { active: Array.from({ length: k }, (_, i) => right - k + 1 + i), left: [leftOut], label: "current window" }, variables: [{ label: "windowSum", value: windowSum, bold: true }, { label: "best", value: best, bold: true }], note: `Window: ${right - k + 1}..${right}` })); }
  frames.push(baseFrame({ name: "Answer", title: title || "Sliding Window", subtitle: `Answer best = ${best}`, centerX, codeLines, activeLine: 5, values: arr, arrayOptions: { label: "array" }, variables: [{ label: "best", value: best, bold: true }], note: "Fixed-size sliding window complete." }));
  return frames;
}
