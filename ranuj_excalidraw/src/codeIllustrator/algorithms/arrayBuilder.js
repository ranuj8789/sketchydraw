import { baseFrame, listGraphicElements, rangeIndexes } from "../frameBase";
import { getCodeLines, findActiveLineIndex } from "../parser";

function normalizeDutch(values) {
  const cleaned = values.map((value) => Math.abs(Math.trunc(Number(value) || 0)) % 3);
  return cleaned.length ? cleaned : [2, 0, 2, 1, 1, 0];
}

function lineIndex(lines, patterns, fallback = 0) {
  const found = findActiveLineIndex(lines, patterns);
  return found >= 0 ? found : fallback;
}

export function dutchFlagFrames(numbers, centerX, title, code) {
  const arr = normalizeDutch(numbers).slice(0, 10);
  const codeLines = getCodeLines(code, [
    "low = 0, mid = 0, high = n - 1",
    "while mid <= high:",
    "if arr[mid] == 0: swap low and mid; low++; mid++",
    "else if arr[mid] == 1: mid++",
    "else: swap mid and high; high--",
    "return arr",
  ]);
  const frames = [];
  let low = 0;
  let mid = 0;
  let high = arr.length - 1;
  frames.push(baseFrame({
    name: "Input",
    title: title || "Dutch National Flag",
    subtitle: `Sort only 0, 1, 2 in one pass: [${arr.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["low", "mid", "high"]),
    values: arr,
    arrayOptions: { active: [mid], left: [low], right: [high], label: "array: 0s | 1s | unknown | 2s" },
    variables: [{ label: "low", value: low }, { label: "mid", value: mid, bold: true }, { label: "high", value: high }],
    note: "Goal: left side 0, middle 1, right side 2. Pointers divide the array into zones.",
  }));

  let guard = 0;
  while (mid <= high && guard < 40) {
    guard += 1;
    const value = arr[mid];
    if (value === 0) {
      [arr[low], arr[mid]] = [arr[mid], arr[low]];
      frames.push(baseFrame({
        name: `0 at mid ${mid}`,
        title: title || "Dutch National Flag",
        subtitle: `arr[mid] is 0, swap arr[low] and arr[mid]`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["== 0", "arr[mid] == 0", "swap"]),
        values: arr,
        arrayOptions: { active: [low, mid], sorted: rangeIndexes(0, low), right: [high], label: "swap 0 to left zone" },
        variables: [{ label: "action", value: `swap ${low}, ${mid}`, bold: true }, { label: "low", value: low }, { label: "mid", value: mid }, { label: "high", value: high }],
        note: "0 belongs to the left zone. After swap, low and mid both move forward.",
      }));
      low += 1; mid += 1;
    } else if (value === 1) {
      frames.push(baseFrame({
        name: `1 at mid ${mid}`,
        title: title || "Dutch National Flag",
        subtitle: `arr[mid] is 1, keep it in the middle zone`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["== 1", "arr[mid] == 1", "mid++"]),
        values: arr,
        arrayOptions: { active: [mid], sorted: low > 0 ? rangeIndexes(0, low - 1) : [], right: [high], label: "1 stays in middle" },
        variables: [{ label: "action", value: "mid++", bold: true }, { label: "low", value: low }, { label: "mid", value: mid }, { label: "high", value: high }],
        note: "1 is already in the correct middle zone, so only mid moves.",
      }));
      mid += 1;
    } else {
      [arr[mid], arr[high]] = [arr[high], arr[mid]];
      frames.push(baseFrame({
        name: `2 at mid ${mid}`,
        title: title || "Dutch National Flag",
        subtitle: `arr[mid] is 2, swap arr[mid] and arr[high]`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["else", "high--", "== 2"]),
        values: arr,
        arrayOptions: { active: [mid, high], sorted: low > 0 ? rangeIndexes(0, low - 1) : [], right: [high], label: "swap 2 to right zone" },
        variables: [{ label: "action", value: `swap ${mid}, ${high}`, bold: true }, { label: "low", value: low }, { label: "mid", value: mid }, { label: "high", value: high }],
        note: "2 belongs to the right zone. high moves left; mid stays because swapped value is still unknown.",
      }));
      high -= 1;
    }
  }
  frames.push(baseFrame({
    name: "Sorted 0-1-2",
    title: title || "Dutch National Flag",
    subtitle: `Done: [${arr.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["return"]),
    values: arr,
    arrayOptions: { sorted: arr.map((_, i) => i), label: "sorted answer" },
    variables: [{ label: "answer", value: `[${arr.join(", ")}]`, bold: true }],
    note: "One pass complete: all 0s, then 1s, then 2s.",
  }));
  return frames;
}

export function moveZerosFrames(numbers, centerX, title, code) {
  const arr = [...numbers].slice(0, 10);
  const result = [...arr];
  const codeLines = getCodeLines(code, [
    "insert = 0",
    "for i from 0 to n-1:",
    "if arr[i] != 0: arr[insert] = arr[i]; insert++",
    "while insert < n: arr[insert] = 0; insert++",
    "return arr",
  ]);
  const frames = [];
  let insert = 0;
  frames.push(baseFrame({
    name: "Input",
    title: title || "Move Zeroes To End",
    subtitle: `Keep non-zero order, move all 0s to last indexes`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["insert"]),
    values: arr,
    arrayOptions: { label: "input array" },
    variables: [{ label: "insert", value: insert }, { label: "idea", value: "next non-zero position" }],
    note: "insert points to where the next non-zero value should be written.",
  }));
  for (let i = 0; i < result.length; i += 1) {
    const value = arr[i];
    if (value !== 0) {
      result[insert] = value;
      frames.push(baseFrame({
        name: `Keep ${value}`,
        title: title || "Move Zeroes To End",
        subtitle: `arr[${i}] = ${value}, write it at insert=${insert}`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["!= 0", "insert++", "arr[insert]"]),
        values: result,
        arrayOptions: { active: [i, insert], sorted: insert > 0 ? rangeIndexes(0, insert - 1) : [], label: "working array" },
        variables: [{ label: "i", value: i }, { label: "arr[i]", value }, { label: "insert", value: insert, bold: true }],
        note: "Non-zero value is copied forward. Relative order remains same.",
      }));
      insert += 1;
    } else {
      frames.push(baseFrame({
        name: `Skip zero ${i}`,
        title: title || "Move Zeroes To End",
        subtitle: `arr[${i}] is 0, skip for now`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["if", "!= 0"]),
        values: result,
        arrayOptions: { active: [i], duplicate: [i], sorted: insert > 0 ? rangeIndexes(0, insert - 1) : [], label: "zero skipped" },
        variables: [{ label: "i", value: i }, { label: "insert", value: insert, bold: true }],
        note: "Zeros are not copied now; they will be filled at the end.",
      }));
    }
  }
  while (insert < result.length) {
    result[insert] = 0;
    frames.push(baseFrame({
      name: `Fill zero ${insert}`,
      title: title || "Move Zeroes To End",
      subtitle: `Fill arr[${insert}] = 0`,
      centerX,
      codeLines,
      activeLine: lineIndex(codeLines, ["while", "= 0"]),
      values: result,
      arrayOptions: { active: [insert], sorted: rangeIndexes(0, insert), label: "fill remaining zeros" },
      variables: [{ label: "insert", value: insert, bold: true }, { label: "write", value: 0 }],
      note: "All remaining positions become zero.",
    }));
    insert += 1;
  }
  frames.push(baseFrame({
    name: "Answer",
    title: title || "Move Zeroes To End",
    subtitle: `Answer: [${result.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["return"]),
    values: result,
    arrayOptions: { sorted: result.map((_, i) => i), label: "final array" },
    variables: [{ label: "answer", value: `[${result.join(", ")}]`, bold: true }],
    note: "Non-zero elements stay in original order, zeros are at last indexes.",
  }));
  return frames;
}

export function removeDuplicatesFrames(numbers, centerX, title, code) {
  const arr = [...numbers].slice(0, 10);
  const unique = [];
  const seen = new Set();
  const codeLines = getCodeLines(code, [
    "seen = empty set, result = empty list",
    "for each x in arr:",
    "if x not in seen: add x to result and seen",
    "else: skip duplicate",
    "return result",
  ]);
  const frames = [baseFrame({
    name: "Input",
    title: title || "Remove Duplicates From Array",
    subtitle: `Build unique array from [${arr.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["seen", "result"]),
    values: arr,
    arrayOptions: { label: "input array" },
    variables: [{ label: "seen", value: "{}" }, { label: "result", value: "[]" }],
    note: "Use a set to remember what already appeared.",
    extra: listGraphicElements([], { centerX, listName: "unique", y: 446 }),
  })];
  arr.forEach((value, i) => {
    if (seen.has(value)) {
      frames.push(baseFrame({
        name: `Skip duplicate ${value}`,
        title: title || "Remove Duplicates From Array",
        subtitle: `${value} already exists, so skip it`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["else", "skip", "contains"]),
        values: arr,
        arrayOptions: { active: [i], duplicate: [i], label: "input array" },
        variables: [{ label: "x", value }, { label: "seen", value: `{${Array.from(seen).join(", ")}}` }, { label: "action", value: "skip duplicate", bold: true }],
        note: "Duplicate detected. Output list does not change.",
        extra: listGraphicElements(unique, { centerX, listName: "unique", activeIndex: -1, y: 446 }),
      }));
    } else {
      seen.add(value);
      unique.push(value);
      frames.push(baseFrame({
        name: `Add unique ${value}`,
        title: title || "Remove Duplicates From Array",
        subtitle: `${value} is new, add it to result`,
        centerX,
        codeLines,
        activeLine: lineIndex(codeLines, ["not in", "!seen", "add"]),
        values: arr,
        arrayOptions: { active: [i], sorted: rangeIndexes(0, i), label: "input array" },
        variables: [{ label: "x", value }, { label: "seen", value: `{${Array.from(seen).join(", ")}}` }, { label: "result", value: `[${unique.join(", ")}]`, bold: true }],
        note: "First time value appears, keep it in output.",
        extra: listGraphicElements(unique, { centerX, listName: "unique", activeIndex: unique.length - 1, y: 446 }),
      }));
    }
  });
  frames.push(baseFrame({
    name: "Answer",
    title: title || "Remove Duplicates From Array",
    subtitle: `Unique output = [${unique.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["return"]),
    values: arr,
    arrayOptions: { label: "original input" },
    variables: [{ label: "answer", value: `[${unique.join(", ")}]`, bold: true }],
    note: "Duplicates removed while preserving first occurrence order.",
    extra: listGraphicElements(unique, { centerX, listName: "unique answer", y: 446 }),
  }));
  return frames;
}

export function reverseArrayFrames(numbers, centerX, title, code) {
  const arr = [...numbers].slice(0, 10);
  const codeLines = getCodeLines(code, [
    "left = 0, right = n - 1",
    "while left < right:",
    "swap arr[left] and arr[right]",
    "left++, right--",
    "return arr",
  ]);
  const frames = [];
  let left = 0;
  let right = arr.length - 1;
  frames.push(baseFrame({
    name: "Input",
    title: title || "Reverse Array",
    subtitle: `Reverse [${arr.join(", ")}] using two pointers`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["left", "right"]),
    values: arr,
    arrayOptions: { left: [left], right: [right], label: "array" },
    variables: [{ label: "left", value: left }, { label: "right", value: right }],
    note: "left starts at first index, right starts at last index.",
  }));
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]];
    frames.push(baseFrame({
      name: `Swap ${left} and ${right}`,
      title: title || "Reverse Array",
      subtitle: `Swap arr[${left}] and arr[${right}]`,
      centerX,
      codeLines,
      activeLine: lineIndex(codeLines, ["swap", "arr[left]"]),
      values: arr,
      arrayOptions: { active: [left, right], sorted: [...rangeIndexes(0, left), ...rangeIndexes(right, arr.length - 1)], label: "after swap" },
      variables: [{ label: "left", value: left, bold: true }, { label: "right", value: right, bold: true }, { label: "action", value: "swap" }],
      note: "Outer pair is fixed after this swap.",
    }));
    left += 1;
    right -= 1;
  }
  frames.push(baseFrame({
    name: "Answer",
    title: title || "Reverse Array",
    subtitle: `Reversed array = [${arr.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["return"]),
    values: arr,
    arrayOptions: { sorted: arr.map((_, i) => i), label: "reversed answer" },
    variables: [{ label: "answer", value: `[${arr.join(", ")}]`, bold: true }],
    note: "Two-pointer reverse complete in O(n) time and O(1) extra space.",
  }));
  return frames;
}

export function arrayMaxFrames(numbers, centerX, title, code) {
  const arr = [...numbers].slice(0, 10);
  const codeLines = getCodeLines(code, [
    "max = arr[0]",
    "for i from 1 to n-1:",
    "if arr[i] > max: max = arr[i]",
    "return max",
  ]);
  const frames = [];
  let maxValue = arr[0];
  let maxIndex = 0;
  frames.push(baseFrame({
    name: "Input",
    title: title || "Find Maximum In Array",
    subtitle: `Find max value in [${arr.join(", ")}]`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["max =", "max = arr[0]"]),
    values: arr,
    arrayOptions: { active: [0], label: "array" },
    variables: [{ label: "max", value: maxValue, bold: true }, { label: "maxIndex", value: maxIndex }],
    note: "Start by assuming first element is maximum.",
  }));
  for (let i = 1; i < arr.length; i += 1) {
    const foundNew = arr[i] > maxValue;
    if (foundNew) { maxValue = arr[i]; maxIndex = i; }
    frames.push(baseFrame({
      name: foundNew ? `New max ${arr[i]}` : `Check ${arr[i]}`,
      title: title || "Find Maximum In Array",
      subtitle: foundNew ? `${arr[i]} > old max, update max` : `${arr[i]} <= max, keep current max`,
      centerX,
      codeLines,
      activeLine: lineIndex(codeLines, ["> max", "max = arr", "if"]),
      values: arr,
      arrayOptions: { active: [i], sorted: [maxIndex], label: "scan array" },
      variables: [{ label: "i", value: i }, { label: "arr[i]", value: arr[i] }, { label: "max", value: maxValue, bold: true }, { label: "maxIndex", value: maxIndex }],
      note: foundNew ? "New bigger value found, so max changes." : "Current value is smaller, max remains same.",
    }));
  }
  frames.push(baseFrame({
    name: "Answer",
    title: title || "Find Maximum In Array",
    subtitle: `Maximum value = ${maxValue} at index ${maxIndex}`,
    centerX,
    codeLines,
    activeLine: lineIndex(codeLines, ["return"]),
    values: arr,
    arrayOptions: { active: [maxIndex], sorted: [maxIndex], label: "answer" },
    variables: [{ label: "max", value: maxValue, bold: true }, { label: "index", value: maxIndex }],
    note: "One pass finds maximum in O(n) time.",
  }));
  return frames;
}
