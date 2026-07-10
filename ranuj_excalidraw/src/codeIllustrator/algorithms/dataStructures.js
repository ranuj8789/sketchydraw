import { baseFrame, heapTreeElements, listGraphicElements } from "../frameBase";
import { findActiveLineIndex, getCodeLines } from "../parser";

function mapLabel(map) { return `{${Array.from(map.entries()).map(([k, v]) => `${k}:${v}`).join(", ")}}`; }
function setLabel(set) { return `{${Array.from(set.values()).join(", ")}}`; }

export function duplicateArrayFrames(numbers, centerX, title, code) {
  const arr = [...numbers];
  const codeLines = getCodeLines(code, ["seen = new HashSet()", "duplicates = []", "for x in arr:", "if seen contains x: duplicates.add(x)", "else: seen.add(x)", "return duplicates"]);
  const seen = new Set(); const duplicates = []; const duplicateIndexes = [];
  const frames = [baseFrame({ name: "Input", title: title || "Duplicate Array", subtitle: "Find duplicate values using HashSet", centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["hashset", "set"]), values: arr, arrayOptions: { label: "array" }, variables: [{ label: "seen", value: "{}" }, { label: "duplicates", value: "[]" }], note: "Seen set starts empty.", extra: listGraphicElements([], { centerX, listName: "seen", kind: "set" }) })];
  arr.forEach((value, i) => {
    const duplicate = seen.has(value);
    if (duplicate) { duplicates.push(value); duplicateIndexes.push(i); }
    else seen.add(value);
    frames.push(baseFrame({ name: duplicate ? `Duplicate ${value}` : `Add ${value}`, title: title || "Duplicate Array", subtitle: duplicate ? `${value} already exists → duplicate` : `${value} not seen → add to set`, centerX, codeLines, activeLine: duplicate ? findActiveLineIndex(codeLines, ["contains", "duplicate"]) : findActiveLineIndex(codeLines, ["add"]), values: arr, arrayOptions: { active: [i], duplicate: duplicateIndexes, sorted: Array.from({ length: i }, (_, k) => k), label: "array" }, variables: [{ label: "i", value: i }, { label: "value", value, bold: true }, { label: "seen", value: setLabel(seen) }, { label: "duplicates", value: `[${duplicates.join(", ")}]`, bold: duplicate }], note: duplicate ? "Red marks duplicate index." : "Value inserted into HashSet.", extra: listGraphicElements(Array.from(seen), { centerX, listName: "seen", activeIndex: Array.from(seen).indexOf(value), kind: "set" }) }));
  });
  frames.push(baseFrame({ name: "Answer", title: title || "Duplicate Array", subtitle: `Duplicates = [${duplicates.join(", ")}]`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["return"]), values: arr, arrayOptions: { duplicate: duplicateIndexes, label: "array" }, variables: [{ label: "answer", value: `[${duplicates.join(", ")}]`, bold: true }], note: "HashSet gives O(1) average contains/add.", extra: listGraphicElements(duplicates, { centerX, listName: "duplicates" }) }));
  return frames;
}

export function hashSetFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const codeLines = getCodeLines(code, ["set = new HashSet()", "for x in arr:", "if set contains x: duplicate", "set.add(x)", "return set"]);
  const set = new Set(); const frames = [baseFrame({ name: "Create HashSet", title: title || "HashSet Visualizer", subtitle: "HashSet keeps unique values", centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "input array" }, variables: [{ label: "set", value: "{}", bold: true }], note: "Create empty HashSet.", extra: listGraphicElements([], { centerX, listName: "set", kind: "set" }) })];
  arr.forEach((value, i) => { const existed = set.has(value); if (!existed) set.add(value); frames.push(baseFrame({ name: existed ? `Already has ${value}` : `Add ${value}`, title: title || "HashSet Visualizer", subtitle: existed ? `${value} already exists, skip add` : `set.add(${value})`, centerX, codeLines, activeLine: existed ? findActiveLineIndex(codeLines, ["contains", "duplicate"]) : findActiveLineIndex(codeLines, ["add"]), values: arr, arrayOptions: { active: [i], duplicate: existed ? [i] : [], sorted: Array.from({ length: i }, (_, k) => k), label: "input array" }, variables: [{ label: "i", value: i }, { label: "value", value }, { label: "alreadyExists", value: existed ? "true" : "false" }, { label: "set", value: setLabel(set), bold: true }], note: existed ? "HashSet blocks duplicate values." : "New unique value inserted.", extra: listGraphicElements(Array.from(set), { centerX, listName: "set", activeIndex: Array.from(set).indexOf(value), kind: "set" }) })); });
  return frames;
}

export function hashMapFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const codeLines = getCodeLines(code, ["map = new HashMap()", "for i from 0 to n-1:", "map.put(arr[i], i)", "return map"]);
  const map = new Map(); const frames = [baseFrame({ name: "Create HashMap", title: title || "HashMap Visualizer", subtitle: "HashMap stores key → value", centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "input array" }, variables: [{ label: "map", value: "{}", bold: true }], note: "Create empty HashMap.", extra: listGraphicElements([], { centerX, listName: "map", kind: "map" }) })];
  arr.forEach((value, i) => { const existed = map.has(value); map.set(value, i); const entries = Array.from(map.entries()).map(([k, v]) => `${k}:${v}`); frames.push(baseFrame({ name: existed ? `Update key ${value}` : `Put ${value}`, title: title || "HashMap Visualizer", subtitle: `map.put(${value}, ${i})`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["put", "set"]), values: arr, arrayOptions: { active: [i], duplicate: existed ? [i] : [], label: "input array" }, variables: [{ label: "key", value }, { label: "value/index", value: i }, { label: "previousKey", value: existed ? "yes" : "no" }, { label: "map", value: mapLabel(map), bold: true }], note: existed ? "Existing key updated." : "New key-value pair inserted.", extra: listGraphicElements(entries, { centerX, listName: "map", activeIndex: entries.length - 1, kind: "map" }) })); });
  return frames;
}

export function stackFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const codeLines = getCodeLines(code, ["stack = new Stack()", "for x in arr: stack.push(x)", "while not empty: stack.pop()"]);
  const stack = []; const frames = [baseFrame({ name: "Create stack", title: title || "Stack Visualizer", subtitle: "LIFO: last in, first out", centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "input" }, variables: [{ label: "stack", value: "[]" }], note: "Create empty stack.", extra: listGraphicElements(stack, { centerX, listName: "stack", kind: "stack" }) })];
  arr.forEach((value, i) => { stack.push(value); frames.push(baseFrame({ name: `Push ${value}`, title: title || "Stack Visualizer", subtitle: `push(${value})`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["push"]), values: arr, arrayOptions: { active: [i], label: "input" }, variables: [{ label: "top", value }, { label: "size", value: stack.length }, { label: "stack", value: `[${stack.join(", ")}]`, bold: true }], note: "New value goes on top.", extra: listGraphicElements(stack, { centerX, listName: "stack", activeIndex: stack.length - 1, kind: "stack" }) })); });
  const pops = [...stack]; while (pops.length && frames.length < 30) { const popped = pops.pop(); frames.push(baseFrame({ name: `Pop ${popped}`, title: title || "Stack Visualizer", subtitle: `pop() → ${popped}`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["pop"]), values: arr, arrayOptions: { label: "input" }, variables: [{ label: "popped", value: popped, bold: true }, { label: "size", value: pops.length }, { label: "stack", value: `[${pops.join(", ")}]` }], note: "Last inserted item comes out first.", extra: listGraphicElements(pops, { centerX, listName: "stack", kind: "stack" }) })); }
  return frames;
}

export function queueFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const codeLines = getCodeLines(code, ["queue = new LinkedList()", "for x in arr: queue.offer(x)", "while not empty: queue.poll()"]);
  const queue = []; const frames = [baseFrame({ name: "Create queue", title: title || "Queue Visualizer", subtitle: "FIFO: first in, first out", centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "input" }, variables: [{ label: "queue", value: "[]" }], note: "Create empty queue.", extra: listGraphicElements(queue, { centerX, listName: "queue", kind: "queue" }) })];
  arr.forEach((value, i) => { queue.push(value); frames.push(baseFrame({ name: `Offer ${value}`, title: title || "Queue Visualizer", subtitle: `offer(${value})`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["offer", "add"]), values: arr, arrayOptions: { active: [i], label: "input" }, variables: [{ label: "front", value: queue[0] }, { label: "rear", value }, { label: "queue", value: `[${queue.join(", ")}]`, bold: true }], note: "New value enters at rear.", extra: listGraphicElements(queue, { centerX, listName: "queue", activeIndex: queue.length - 1, kind: "queue" }) })); });
  const q = [...queue]; while (q.length && frames.length < 30) { const out = q.shift(); frames.push(baseFrame({ name: `Poll ${out}`, title: title || "Queue Visualizer", subtitle: `poll() → ${out}`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["poll", "remove"]), values: arr, arrayOptions: { label: "input" }, variables: [{ label: "removed", value: out, bold: true }, { label: "front", value: q[0] ?? "empty" }, { label: "queue", value: `[${q.join(", ")}]` }], note: "First inserted item comes out first.", extra: listGraphicElements(q, { centerX, listName: "queue", kind: "queue" }) })); }
  return frames;
}

export function priorityQueueFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const codeLines = getCodeLines(code, ["pq = new PriorityQueue()", "for x in arr: pq.offer(x)", "while not empty: pq.poll()"]);
  const heap = []; const frames = [baseFrame({ name: "Create PriorityQueue", title: title || "PriorityQueue / Heap", subtitle: "Min-heap: smallest value has highest priority", centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "input" }, variables: [{ label: "heap", value: "[]" }], note: "Create empty min-heap.", extra: heapTreeElements(heap, { centerX }) })];
  const pushHeap = (value) => { heap.push(value); heap.sort((a, b) => a - b); };
  arr.forEach((value, i) => { pushHeap(value); frames.push(baseFrame({ name: `Offer ${value}`, title: title || "PriorityQueue / Heap", subtitle: `offer(${value}) → heap reorders`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["offer", "add", "push"]), values: arr, arrayOptions: { active: [i], label: "input" }, variables: [{ label: "added", value }, { label: "peek/min", value: heap[0] }, { label: "heap array", value: `[${heap.join(", ")}]`, bold: true }], note: "Heap keeps minimum at root.", extra: heapTreeElements(heap, { centerX, activeIndex: heap.indexOf(value) }) })); });
  const pq = [...heap]; while (pq.length && frames.length < 32) { const polled = pq.shift(); frames.push(baseFrame({ name: `Poll ${polled}`, title: title || "PriorityQueue / Heap", subtitle: `poll() → ${polled}`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["poll", "remove"]), values: arr, arrayOptions: { label: "input" }, variables: [{ label: "removed", value: polled, bold: true }, { label: "next peek", value: pq[0] ?? "empty" }, { label: "heap array", value: `[${pq.join(", ")}]` }], note: "Smallest value comes out first.", extra: heapTreeElements(pq, { centerX }) })); }
  return frames;
}

export function variablesFrames(numbers, centerX, title, code) {
  const arr = [...numbers]; const codeLines = getCodeLines(code, ["int sum = 0", "int count = 0", "for x in arr:", "sum += x", "count++", "return sum"]);
  let sum = 0; let count = 0; let max = arr[0] ?? 0;
  const frames = [baseFrame({ name: "Variables init", title: title || "Variables Visualizer", subtitle: "Track variable changes line by line", centerX, codeLines, activeLine: 0, values: arr, arrayOptions: { label: "input" }, variables: [{ label: "sum", value: sum }, { label: "count", value: count }, { label: "max", value: max }], note: "Variables are shown on the right panel." })];
  arr.forEach((value, i) => { sum += value; count += 1; max = Math.max(max, value); frames.push(baseFrame({ name: `Update vars ${i}`, title: title || "Variables Visualizer", subtitle: `Read arr[${i}] = ${value}`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["sum", "+=", "count"]), values: arr, arrayOptions: { active: [i], label: "input" }, variables: [{ label: "i", value: i }, { label: "x", value }, { label: "sum", value: sum, bold: true }, { label: "count", value: count }, { label: "max", value: max }], note: "Use this for general code where variables change in a loop." })); });
  frames.push(baseFrame({ name: "Return", title: title || "Variables Visualizer", subtitle: `Final variables: sum=${sum}, count=${count}, max=${max}`, centerX, codeLines, activeLine: findActiveLineIndex(codeLines, ["return"]), values: arr, arrayOptions: { label: "input" }, variables: [{ label: "sum", value: sum, bold: true }, { label: "count", value: count }, { label: "max", value: max }], note: "Generic variable dry-run complete." }));
  return frames;
}
