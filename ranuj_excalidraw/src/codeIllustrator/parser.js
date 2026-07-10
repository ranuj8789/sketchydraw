import { MAX_ITEMS, DEFAULT_NUMBERS } from "./constants";

export function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCodeIllustratorNumbers(value) {
  const parsed = String(value || "").match(/-?\d+(?:\.\d+)?/g)?.map((item) => safeNumber(item, null)).filter((item) => item !== null);
  return parsed?.length ? parsed.slice(0, MAX_ITEMS) : [...DEFAULT_NUMBERS];
}

export function getCodeLines(code, fallback = ["paste code here"]) {
  const lines = String(code || "").replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 14);
  return lines.length ? lines : fallback;
}

export function findActiveLineIndex(lines, patterns) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  const found = lines.findIndex((line) => list.some((pattern) => String(line).toLowerCase().includes(String(pattern).toLowerCase())));
  return found >= 0 ? found : 0;
}

export function parseTargetFromCode(code, fallback = 7) {
  const match = String(code || "").match(/target\s*[:=]\s*(-?\d+)/i);
  return match ? safeNumber(match[1], fallback) : fallback;
}

export function parseWindowSizeFromCode(code, fallback = 3) {
  const match = String(code || "").match(/\bk\s*[:=]\s*(\d+)/i) || String(code || "").match(/window\s*[:=]\s*(\d+)/i);
  return match ? Math.max(1, safeNumber(match[1], fallback)) : fallback;
}

export function parseLoopCountFromCode(code, fallback) {
  const raw = String(code || "");
  const lessThan = raw.match(/for\s*\([^;]*=[^;]*;\s*[^;<>=]+<\s*(-?\d+)\s*;/i);
  const lessEqual = raw.match(/for\s*\([^;]*=[^;]*;\s*[^;<>=]+<=\s*(-?\d+)\s*;/i);
  if (lessThan) return Math.max(0, Math.min(MAX_ITEMS, safeNumber(lessThan[1], fallback)));
  if (lessEqual) return Math.max(0, Math.min(MAX_ITEMS, safeNumber(lessEqual[1], fallback) + 1));
  const pseudo = raw.match(/from\s+(-?\d+)\s+to\s+(-?\d+)/i);
  if (pseudo) return Math.max(0, Math.min(MAX_ITEMS, safeNumber(pseudo[2], fallback - 1) - safeNumber(pseudo[1], 0) + 1));
  return Math.max(1, Math.min(MAX_ITEMS, fallback || 5));
}

export function inferProblemType({ problemType = "auto", code = "", algorithm = "bubble" } = {}) {
  if (problemType && problemType !== "auto") return problemType;
  const raw = String(code || "").toLowerCase();
  if (raw.includes("priorityqueue") || raw.includes("priority queue") || raw.includes("heap") || raw.includes("heappush") || raw.includes("poll()")) return "priorityQueue";
  if (raw.includes("stack") || (raw.includes(".push(") && raw.includes(".pop("))) return "stack";
  if (raw.includes("queue") || raw.includes("offer(") || raw.includes("poll(")) return "queue";
  if (raw.includes("hashset") || raw.includes("set<") || raw.includes("new set") || raw.includes("set.add") || (raw.includes("duplicates") && raw.includes("seen"))) return "hashSet";
  if (raw.includes("hashmap") || raw.includes("map<") || raw.includes("new map") || raw.includes("map.put") || raw.includes("containskey")) return "hashMap";
  if (raw.includes("duplicate")) return "duplicates";
  if (raw.includes("dutch") || raw.includes("national flag") || (raw.includes("low") && raw.includes("mid") && raw.includes("high") && raw.includes("== 2"))) return "dutchFlag";
  if (raw.includes("move zero") || raw.includes("movezero") || raw.includes("zeroes") || (raw.includes("insert") && raw.includes("!= 0"))) return "moveZeros";
  if (raw.includes("remove duplicate") || raw.includes("removeduplicate") || (raw.includes("seen") && raw.includes("result") && raw.includes("duplicate"))) return "removeDuplicates";
  if (raw.includes("reversearray") || raw.includes("reverse array") || (raw.includes("left") && raw.includes("right") && raw.includes("swap") && !raw.includes("mid"))) return "reverseArray";
  if (raw.includes("array max") || raw.includes("find maximum") || raw.includes("findmax") || (raw.includes("max") && raw.includes("arr[0]") && raw.includes("> max"))) return "arrayMax";
  if (raw.includes("maxsubarray") || raw.includes("max subarray") || raw.includes("kadane") || (raw.includes("currentsum") && raw.includes("maxsum"))) return "maxSubarray";
  if (raw.includes("prefix") || raw.includes("prefixsum")) return "prefixSum";
  if (raw.includes("binarysearch") || raw.includes("binary search") || (raw.includes("left") && raw.includes("right") && raw.includes("mid"))) return "binarySearch";
  if (raw.includes("twosum") || raw.includes("two sum") || raw.includes("target -")) return "twoSum";
  if (raw.includes(".add(") || raw.includes("arraylist") || raw.includes("new list") || raw.includes("list<")) return "genericList";
  if (raw.includes("sliding") || raw.includes("window") || raw.includes("right - k")) return "slidingWindow";
  if (raw.includes("selection")) return "selection";
  if (raw.includes("insertion")) return "insertion";
  if (raw.includes("quick")) return "quick";
  if (raw.includes("bubble")) return "bubble";
  return algorithm || "bubble";
}
