import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pencil,
    Square,
    Circle,
    Slash,
    MousePointer2,
    Eraser,
    Type,
    MoveRight,
    Diamond,
    Hand,
    Image as ImageIcon,
    Code2,
    UserRound,
    PanelLeftOpen,
    PanelLeftClose,
} from "lucide-react";
import PropertiesPanel from "../PropertiesPanel/PropertiesPanel";
import { getAnimationLabel } from "../../canvas/animationRegistry";
import { TIMELINE_PLAYBACK_SPEED_OPTIONS } from "../../canvas/animationTimeline";
import "./Sidebar.css";
import { hasProAccess, requestProUpgrade } from "../../utils/proFeatureGate";
import { ThreeDTab, is3DElement, to3DInsertRequest } from "../3d";

const TOOLS = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "hand", label: "Hand", icon: Hand },
    { id: "pencil", label: "Pencil", icon: Pencil },
    { id: "line", label: "Line", icon: Slash },
    { id: "arrow", label: "Arrow", icon: MoveRight },
    { id: "rect", label: "Rectangle", icon: Square },
    { id: "diamond", label: "Diamond", icon: Diamond },
    { id: "ellipse", label: "Ellipse", icon: Circle },
    { id: "user", label: "User", icon: UserRound, premium: true },
    { id: "text", label: "Text", icon: Type },
    { id: "image", label: "Image", icon: ImageIcon, premium: true },
    { id: "eraser", label: "Eraser", icon: Eraser },
];

const QUICK_EMOJIS = [
    "🔥",
    "⭐",
    "✅",
    "🚀",
    "💡",
    "❤️",
    "👉",
    "🎯",
    "⚡",
    "📌",
    "😊",
    "🏆",
];

const ORDER_DELAY_STEP_OPTIONS = [250, 500, 750, 1000];

const SYSTEM_DESIGN_TOOLS = [
    { id: "cache", title: "Cache", subtitle: "read / write" },
    { id: "database", title: "Database", subtitle: "SQL / NoSQL" },
    { id: "server", title: "Server", subtitle: "app / API" },
    { id: "nginx", title: "Nginx", subtitle: "gateway / LB" },
    { id: "datacenter", title: "Data centre", subtitle: "infra / racks" },
    { id: "kafka", title: "Kafka", subtitle: "event stream" },
    { id: "splunk", title: "Splunk", subtitle: "logs / traces" },
    { id: "security", title: "Security", subtitle: "shield / lock" },
    { id: "broker", title: "Broker", subtitle: "message broker" },
    { id: "partition", title: "Partition", subtitle: "topic split" },
];

function getCurrentFrame(frames = [], currentFrameIndex = 0) {
    return frames[currentFrameIndex] || frames[0] || null;
}

function countAnimatedObjects(frame) {
    return (frame?.elements || []).filter(
        (element) => element?.animation?.type && element.animation.type !== "none"
    ).length;
}

function PrimitiveButton({ title, subtitle, primary = false, onClick }) {
    return (
        <button
            type="button"
            className={primary ? "left-primitive-btn primary" : "left-primitive-btn"}
            onClick={onClick}
        >
            <strong>{title}</strong>
            <span>{subtitle}</span>
        </button>
    );
}

function GifToolsTab({
                         frames = [],
                         currentFrameIndex = 0,
                         animationPlaying = false,
                         animationTimeMs = 0,
                         playbackSpeed = 0.5,
                         onPlaybackSpeedChange,
                         advanceMode = "enter",
                         onAdvanceModeChange,
                         onAddFrameAfter,
                         onToggleFrameAnimation,
                         onApplyFrameObjectOrderTiming,
                         onMergeFrameWithNext,
                         onMergeAllFrames,
                         onInsertGifPrimitive,
                     }) {
    const [orderDelayStep, setOrderDelayStep] = useState(500);

    const currentFrame = useMemo(
        () => getCurrentFrame(frames, currentFrameIndex),
        [frames, currentFrameIndex]
    );

    const objectCount = currentFrame?.elements?.length || 0;
    const animatedCount = countAnimatedObjects(currentFrame);
    const canMergeNext = currentFrameIndex < frames.length - 1;
    const canMergeAll = frames.length > 1;

    const insertPrimitive = (type, options = {}) => {
        onInsertGifPrimitive?.({
            type,
            animated: !!options.animated,
            animationType: options.animationType || (options.animated ? "draw" : "none"),
        });
    };

    const applyOrderTiming = () => {
        onApplyFrameObjectOrderTiming?.(currentFrameIndex, {
            delayStepMs: Number(orderDelayStep) || 500,
        });
    };

    return (
        <div className="left-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>GIF Tools</strong>
                    <span>
                        Frame {currentFrameIndex + 1}/{Math.max(frames.length, 1)} · {objectCount} objects · {animatedCount} animated
                    </span>
                </div>

                <div className="left-tool-grid two">
                    <button type="button" onClick={onAddFrameAfter}>+ Frame</button>
                    <button type="button" onClick={onToggleFrameAnimation}>
                        {animationPlaying ? "Stop preview" : "Preview"}
                    </button>
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Animated primitives</strong>
                    <span>These create GIF objects directly on the current desktop view.</span>
                </div>

                <div className="left-primitive-grid">
                    <PrimitiveButton
                        title="Line"
                        subtitle="static"
                        onClick={() => insertPrimitive("line")}
                    />
                    <PrimitiveButton
                        title="Line"
                        subtitle={getAnimationLabel("draw")}
                        primary
                        onClick={() => insertPrimitive("line", { animated: true, animationType: "draw" })}
                    />
                    <PrimitiveButton
                        title="Arrow"
                        subtitle={getAnimationLabel("movingHead")}
                        primary
                        onClick={() => insertPrimitive("arrow", { animated: true, animationType: "movingHead" })}
                    />
                    <PrimitiveButton
                        title="Arrow"
                        subtitle={getAnimationLabel("movingDashes")}
                        primary
                        onClick={() => insertPrimitive("arrow", { animated: true, animationType: "movingDashes" })}
                    />
                    <PrimitiveButton
                        title="Rectangle"
                        subtitle={getAnimationLabel("draw")}
                        primary
                        onClick={() => insertPrimitive("rectangle", { animated: true, animationType: "draw" })}
                    />
                    <PrimitiveButton
                        title="Rectangle"
                        subtitle={getAnimationLabel("pulseRing")}
                        primary
                        onClick={() => insertPrimitive("rectangle", { animated: true, animationType: "pulseRing" })}
                    />
                    <PrimitiveButton
                        title="Circle"
                        subtitle={getAnimationLabel("pulseRing")}
                        primary
                        onClick={() => insertPrimitive("circle", { animated: true, animationType: "pulseRing" })}
                    />
                    <PrimitiveButton
                        title="Ellipse"
                        subtitle={getAnimationLabel("movingDashes")}
                        primary
                        onClick={() => insertPrimitive("ellipse", { animated: true, animationType: "movingDashes" })}
                    />
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Flow</strong>
                    <span>Order timing uses object order from the right Frames panel.</span>
                </div>

                <label className="left-field">
                    Timeline speed
                    <select value={playbackSpeed} onChange={(event) => onPlaybackSpeedChange?.(Number(event.target.value))}>
                        {TIMELINE_PLAYBACK_SPEED_OPTIONS.map((speed) => (
                            <option key={speed} value={speed}>{speed}×{speed === 0.5 ? " · Slow (default)" : ""}</option>
                        ))}
                    </select>
                </label>

                <label className="left-field">
                    After screen ends
                    <select value={advanceMode} onChange={(event) => onAdvanceModeChange?.(event.target.value)}>
                        <option value="enter">Wait for Enter</option>
                        <option value="auto">Auto next</option>
                    </select>
                </label>

                <label className="left-field">
                    Order delay
                    <select value={orderDelayStep} onChange={(event) => setOrderDelayStep(Number(event.target.value) || 500)}>
                        {ORDER_DELAY_STEP_OPTIONS.map((value) => (
                            <option value={value} key={value}>{value}ms</option>
                        ))}
                    </select>
                </label>

                <button type="button" className="left-full-btn" onClick={applyOrderTiming} disabled={!animatedCount}>
                    Apply order timing
                </button>

                <div className="left-tool-grid two">
                    <button type="button" onClick={onMergeFrameWithNext} disabled={!canMergeNext}>Merge next</button>
                    <button type="button" onClick={onMergeAllFrames} disabled={!canMergeAll}>Merge all</button>
                </div>

                <span className="left-muted-status">Preview time: {Math.round(animationTimeMs)}ms</span>
            </div>
        </div>
    );
}


const CODE_PROBLEMS = [
    { id: "auto", label: "Auto detect from code", hint: "paste code / choose pattern" },
    { id: "systemDesignFoundation", label: "System Design Foundations (5 min)", hint: "30 animated request-response frames" },
    { id: "variables", label: "Variables / Dry Run", hint: "sum, count, max update" },
    { id: "genericList", label: "Generic List / Code Flow", hint: "create list + loop + add values" },
    { id: "hashSet", label: "HashSet", hint: "unique values + contains" },
    { id: "hashMap", label: "HashMap", hint: "key → value table" },
    { id: "duplicates", label: "Duplicate Array", hint: "seen set + duplicate list" },
    { id: "stack", label: "Stack", hint: "push + pop LIFO" },
    { id: "queue", label: "Queue", hint: "offer + poll FIFO" },
    { id: "priorityQueue", label: "PriorityQueue / Heap", hint: "min heap + poll" },
    { id: "dutchFlag", label: "Array: Dutch Flag", hint: "0/1/2 with low-mid-high" },
    { id: "moveZeros", label: "Array: Move Zeroes", hint: "non-zero first, zeros last" },
    { id: "removeDuplicates", label: "Array: Remove Duplicates", hint: "seen set + unique output" },
    { id: "reverseArray", label: "Array: Reverse", hint: "two-pointer swap" },
    { id: "arrayMax", label: "Array: Find Max", hint: "scan and update max" },
    { id: "maxSubarray", label: "Maximum Sum Subarray", hint: "Kadane dry run" },
    { id: "prefixSum", label: "Prefix Sum", hint: "array cumulative sum" },
    { id: "twoSum", label: "Two Sum", hint: "hash map + target" },
    { id: "binarySearch", label: "Binary Search", hint: "left / right / mid" },
    { id: "slidingWindow", label: "Sliding Window", hint: "fixed window k" },
    { id: "bubble", label: "Bubble Sort", hint: "compare + swap" },
    { id: "selection", label: "Selection Sort", hint: "find minimum" },
    { id: "insertion", label: "Insertion Sort", hint: "shift + insert" },
    { id: "quick", label: "Quick Sort", hint: "pivot partition" },
];

const CODE_LANGUAGES = [
    { id: "java", label: "Java" },
    { id: "python", label: "Python" },
    { id: "javascript", label: "JavaScript" },
];

const CODE_PRESETS = {
    systemDesignFoundation: {
        numbers: "",
        title: "System Design Foundations",
        code: `User sends HTTPS request
Application server validates and authorizes
Check cache
Query database on cache miss
Log and measure the operation
Return response to user`,
    },
    dutchFlag: {
        numbers: "2, 0, 2, 1, 1, 0",
        title: "Dutch National Flag",
        codeByLanguage: {
            java: `public void sortColors(int[] arr) {
    int low = 0, mid = 0, high = arr.length - 1;
    while (mid <= high) {
        if (arr[mid] == 0) {
            swap(arr, low, mid);
            low++;
            mid++;
        } else if (arr[mid] == 1) {
            mid++;
        } else {
            swap(arr, mid, high);
            high--;
        }
    }
}`,
            python: `def sort_colors(arr):
    low = mid = 0
    high = len(arr) - 1
    while mid <= high:
        if arr[mid] == 0:
            arr[low], arr[mid] = arr[mid], arr[low]
            low += 1
            mid += 1
        elif arr[mid] == 1:
            mid += 1
        else:
            arr[mid], arr[high] = arr[high], arr[mid]
            high -= 1
    return arr`,
            javascript: `function sortColors(arr) {
  let low = 0, mid = 0, high = arr.length - 1;
  while (mid <= high) {
    if (arr[mid] === 0) {
      [arr[low], arr[mid]] = [arr[mid], arr[low]];
      low++;
      mid++;
    } else if (arr[mid] === 1) {
      mid++;
    } else {
      [arr[mid], arr[high]] = [arr[high], arr[mid]];
      high--;
    }
  }
  return arr;
}`,
        },
    },
    moveZeros: {
        numbers: "0, 1, 0, 3, 12, 0, 5",
        title: "Move Zeroes To End",
        codeByLanguage: {
            java: `public void moveZeroes(int[] arr) {
    int insert = 0;
    for (int i = 0; i < arr.length; i++) {
        if (arr[i] != 0) {
            arr[insert] = arr[i];
            insert++;
        }
    }
    while (insert < arr.length) {
        arr[insert] = 0;
        insert++;
    }
}`,
            python: `def move_zeroes(arr):
    insert = 0
    for i in range(len(arr)):
        if arr[i] != 0:
            arr[insert] = arr[i]
            insert += 1
    while insert < len(arr):
        arr[insert] = 0
        insert += 1
    return arr`,
            javascript: `function moveZeroes(arr) {
  let insert = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== 0) {
      arr[insert] = arr[i];
      insert++;
    }
  }
  while (insert < arr.length) {
    arr[insert] = 0;
    insert++;
  }
  return arr;
}`,
        },
    },
    removeDuplicates: {
        numbers: "2, 1, 2, 3, 1, 4, 2",
        title: "Remove Duplicates From Array",
        codeByLanguage: {
            java: `public List<Integer> removeDuplicates(int[] arr) {
    HashSet<Integer> seen = new HashSet<>();
    List<Integer> result = new ArrayList<>();
    for (int x : arr) {
        if (!seen.contains(x)) {
            seen.add(x);
            result.add(x);
        }
    }
    return result;
}`,
            python: `def remove_duplicates(arr):
    seen = set()
    result = []
    for x in arr:
        if x not in seen:
            seen.add(x)
            result.append(x)
    return result`,
            javascript: `function removeDuplicates(arr) {
  const seen = new Set();
  const result = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      result.push(x);
    }
  }
  return result;
}`,
        },
    },
    reverseArray: {
        numbers: "1, 2, 3, 4, 5, 6",
        title: "Reverse Array",
        codeByLanguage: {
            java: `public void reverse(int[] arr) {
    int left = 0;
    int right = arr.length - 1;
    while (left < right) {
        int temp = arr[left];
        arr[left] = arr[right];
        arr[right] = temp;
        left++;
        right--;
    }
}`,
            python: `def reverse_array(arr):
    left = 0
    right = len(arr) - 1
    while left < right:
        arr[left], arr[right] = arr[right], arr[left]
        left += 1
        right -= 1
    return arr`,
            javascript: `function reverseArray(arr) {
  let left = 0;
  let right = arr.length - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]];
    left++;
    right--;
  }
  return arr;
}`,
        },
    },
    arrayMax: {
        numbers: "5, 2, 9, 1, 7, 3",
        title: "Find Maximum In Array",
        codeByLanguage: {
            java: `public int findMax(int[] arr) {
    int max = arr[0];
    for (int i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
}`,
            python: `def find_max(arr):
    max_value = arr[0]
    for i in range(1, len(arr)):
        if arr[i] > max_value:
            max_value = arr[i]
    return max_value`,
            javascript: `function findMax(arr) {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}`,
        },
    },
    maxSubarray: {
        numbers: "-2, 1, -3, 4, -1, 2, 1, -5, 4",
        title: "Maximum Sum Subarray",
        code: `function maxSubArray(arr) {
  let currentSum = arr[0];
  let maxSum = arr[0];
  for (let i = 1; i < arr.length; i++) {
    currentSum = Math.max(arr[i], currentSum + arr[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  return maxSum;
}`,
    },
    prefixSum: {
        numbers: "2, 4, 1, 7, 3",
        title: "Prefix Sum Array",
        code: `function prefixSum(arr) {
  let sum = 0;
  let prefix = [];
  for (let i = 0; i < arr.length; i++) {
    sum = sum + arr[i];
    prefix[i] = sum;
  }
  return prefix;
}`,
    },
    twoSum: {
        numbers: "2, 7, 11, 15",
        title: "Two Sum",
        code: `const target = 9;
function twoSum(arr, target) {
  const map = new Map();
  for (let i = 0; i < arr.length; i++) {
    const need = target - arr[i];
    if (map.has(need)) return [map.get(need), i];
    map.set(arr[i], i);
  }
}`,
    },
    binarySearch: {
        numbers: "1, 3, 4, 6, 8, 10, 13",
        title: "Binary Search",
        code: `const target = 8;
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    let mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
    },
    slidingWindow: {
        numbers: "2, 1, 5, 1, 3, 2",
        title: "Sliding Window Max Sum",
        code: `const k = 3;
function maxWindowSum(arr, k) {
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i];
  let best = windowSum;
  for (let right = k; right < arr.length; right++) {
    windowSum += arr[right] - arr[right - k];
    best = Math.max(best, windowSum);
  }
  return best;
}`,
    },
    genericList: {
        numbers: "0, 1, 2, 3",
        title: "Generic List Add Flow",
        code: `List<Integer> list = new ArrayList<>();
for (int i = 0; i < 4; i++) {
  list.add(i);
}
return list;`,
    },
    variables: {
        numbers: "5, 2, 9, 1, 7",
        title: "Variables Dry Run",
        code: `int sum = 0;
int count = 0;
int max = arr[0];
for (int x : arr) {
  sum += x;
  count++;
  max = Math.max(max, x);
}
return sum;`,
    },
    hashSet: {
        numbers: "2, 1, 5, 1, 3, 2",
        title: "HashSet Unique Flow",
        code: `HashSet<Integer> seen = new HashSet<>();
for (int x : arr) {
  if (seen.contains(x)) {
    // duplicate
  }
  seen.add(x);
}
return seen;`,
    },
    hashMap: {
        numbers: "2, 7, 2, 9, 7",
        title: "HashMap Put Flow",
        code: `HashMap<Integer, Integer> map = new HashMap<>();
for (int i = 0; i < arr.length; i++) {
  map.put(arr[i], i);
}
return map;`,
    },
    duplicates: {
        numbers: "2, 1, 5, 1, 3, 2",
        title: "Duplicate Array",
        code: `HashSet<Integer> seen = new HashSet<>();
List<Integer> duplicates = new ArrayList<>();
for (int x : arr) {
  if (seen.contains(x)) duplicates.add(x);
  else seen.add(x);
}
return duplicates;`,
    },
    stack: {
        numbers: "4, 1, 7, 3",
        title: "Stack Push Pop",
        code: `Stack<Integer> stack = new Stack<>();
for (int x : arr) {
  stack.push(x);
}
while (!stack.isEmpty()) {
  stack.pop();
}`,
    },
    queue: {
        numbers: "4, 1, 7, 3",
        title: "Queue Offer Poll",
        code: `Queue<Integer> queue = new LinkedList<>();
for (int x : arr) {
  queue.offer(x);
}
while (!queue.isEmpty()) {
  queue.poll();
}`,
    },
    priorityQueue: {
        numbers: "5, 1, 8, 3, 2",
        title: "PriorityQueue Min Heap",
        code: `PriorityQueue<Integer> pq = new PriorityQueue<>();
for (int x : arr) {
  pq.offer(x);
}
while (!pq.isEmpty()) {
  pq.poll();
}`,
    },
    bubble: {
        numbers: "5, 3, 8, 4, 2",
        title: "Bubble Sort",
        code: `function bubbleSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}`,
    },
};

function getPresetCode(preset, language) {
    if (!preset) return "";
    if (preset.codeByLanguage) return preset.codeByLanguage[language] || preset.codeByLanguage.java || "";
    return preset.code || "";
}

function getPresetForLanguage(presetKey, language) {
    const preset = CODE_PRESETS[presetKey];
    if (!preset) return null;
    return { ...preset, code: getPresetCode(preset, language) };
}

function CodeIllustratorTab({ onGenerateCodeIllustration }) {
    const [problemType, setProblemType] = useState("dutchFlag");
    const [language, setLanguage] = useState("java");
    const initialPreset = getPresetForLanguage("dutchFlag", "java");
    const [numbers, setNumbers] = useState(initialPreset.numbers);
    const [title, setTitle] = useState(initialPreset.title);
    const [code, setCode] = useState(initialPreset.code);

    const selectedProblem = CODE_PROBLEMS.find((item) => item.id === problemType) || CODE_PROBLEMS[0];

    const generate = () => {
        onGenerateCodeIllustration?.({
            algorithm: problemType,
            problemType,
            numbers,
            code,
            language,
            title: title || selectedProblem.label,
        });
    };

    const applyPreset = (presetKey) => {
        const preset = getPresetForLanguage(presetKey, language);
        if (!preset) return;
        setProblemType(presetKey);
        setNumbers(preset.numbers);
        setTitle(preset.title);
        setCode(preset.code);
    };

    const onProblemChange = (value) => {
        setProblemType(value);
        if (CODE_PRESETS[value]) {
            const preset = getPresetForLanguage(value, language);
            setNumbers(preset.numbers);
            setTitle(preset.title);
            setCode(preset.code);
        }
    };

    const onLanguageChange = (value) => {
        setLanguage(value);
        const preset = getPresetForLanguage(problemType, value);
        if (preset) setCode(preset.code);
    };

    return (
        <div className="left-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Code Illustrator</strong>
                    <span>Paste code, choose pattern, generate editable animation frames.</span>
                </div>

                <label className="left-field">
                    Coding problem / pattern
                    <select value={problemType} onChange={(event) => onProblemChange(event.target.value)}>
                        {CODE_PROBLEMS.map((item) => (
                            <option value={item.id} key={item.id}>{item.label}</option>
                        ))}
                    </select>
                </label>

                <label className="left-field">
                    Code language
                    <select value={language} onChange={(event) => onLanguageChange(event.target.value)}>
                        {CODE_LANGUAGES.map((item) => (
                            <option value={item.id} key={item.id}>{item.label}</option>
                        ))}
                    </select>
                </label>

                <div className="code-illustrator-active">
                    <Code2 size={18} />
                    <span>{selectedProblem.label}: {selectedProblem.hint}</span>
                </div>

                <label className="left-field">
                    Array / input values
                    <input
                        value={numbers}
                        onChange={(event) => setNumbers(event.target.value)}
                        placeholder="-2, 1, -3, 4, -1, 2"
                    />
                </label>

                <label className="left-field">
                    Title
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Maximum Sum Subarray"
                    />
                </label>

                <label className="left-field">
                    Paste code / pseudo-code
                    <textarea
                        className="code-illustrator-code-input"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        rows={10}
                        spellCheck={false}
                        placeholder="Paste JavaScript / Java / pseudo-code here"
                    />
                </label>

                <button type="button" className="left-primary-btn wide" onClick={generate}>
                    Generate proper frames
                </button>

                <button type="button" onClick={() => applyPreset("maxSubarray")}>Max subarray demo</button>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Quick templates</strong>
                    <span>These create frames for common coding problems.</span>
                </div>

                <div className="code-template-grid">
                    <button type="button" onClick={() => applyPreset("systemDesignFoundation")}>System Design 5 min</button>
                    <button type="button" onClick={() => applyPreset("variables")}>Variables</button>
                    <button type="button" onClick={() => applyPreset("genericList")}>List add</button>
                    <button type="button" onClick={() => applyPreset("hashSet")}>HashSet</button>
                    <button type="button" onClick={() => applyPreset("hashMap")}>HashMap</button>
                    <button type="button" onClick={() => applyPreset("duplicates")}>Duplicates</button>
                    <button type="button" onClick={() => applyPreset("stack")}>Stack</button>
                    <button type="button" onClick={() => applyPreset("queue")}>Queue</button>
                    <button type="button" onClick={() => applyPreset("priorityQueue")}>Heap / PQ</button>
                    <button type="button" onClick={() => applyPreset("dutchFlag")}>Dutch 0/1/2</button>
                    <button type="button" onClick={() => applyPreset("moveZeros")}>Move zeroes</button>
                    <button type="button" onClick={() => applyPreset("removeDuplicates")}>Remove duplicate</button>
                    <button type="button" onClick={() => applyPreset("reverseArray")}>Reverse array</button>
                    <button type="button" onClick={() => applyPreset("arrayMax")}>Array max</button>
                    <button type="button" onClick={() => applyPreset("maxSubarray")}>Max subarray</button>
                    <button type="button" onClick={() => applyPreset("prefixSum")}>Prefix sum</button>
                    <button type="button" onClick={() => applyPreset("twoSum")}>Two sum</button>
                    <button type="button" onClick={() => applyPreset("binarySearch")}>Binary search</button>
                    <button type="button" onClick={() => applyPreset("slidingWindow")}>Sliding window</button>
                    <button type="button" onClick={() => applyPreset("bubble")}>Bubble sort</button>
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Output</strong>
                    <span>Frames are not blank boxes now. Each frame has code, array, variables and explanation.</span>
                </div>

                <div className="code-illustrator-help">
                    <p>Supported now: 5-minute System Design Foundations, Array Builder (Dutch 0/1/2, move zeroes, remove duplicates, reverse array, find max), variables, generic list, HashSet, HashMap, duplicate array, stack, queue, PriorityQueue/heap, max subarray, prefix sum, two sum, binary search, sliding window, and sorting.</p>
                    <p>Auto detect works from words like <b>HashSet</b>, <b>HashMap</b>, <b>Stack</b>, <b>Queue</b>, <b>PriorityQueue</b>, <b>duplicate</b>, <b>list.add(i)</b>, <b>target = 9</b>, and <b>k = 3</b>.</p>
                </div>
            </div>
        </div>
    );
}


function SystemDesignTab({ tool, setTool }) {
    return (
        <div className="left-tab-panel">
            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>System design</strong>
                    <span>Pick a system block, then drag on the canvas to draw it just like the User tool.</span>
                </div>

                <div className="left-primitive-grid">
                    {SYSTEM_DESIGN_TOOLS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`left-primitive-btn left-system-btn ${tool === item.id ? "active" : ""}`}
                            onClick={() => setTool(item.id)}
                        >
                            <strong>{item.title}</strong>
                            <span>{item.subtitle}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="left-tool-card">
                <div className="left-card-heading">
                    <strong>Usage</strong>
                    <span>These are real drawable tools now, not pre-inserted overlapping groups.</span>
                </div>
                <div className="code-illustrator-help">
                    <p>Select one block here and drag on the canvas to place it.</p>
                    <p>After drawing, you can resize, recolor, animate and connect it with arrows.</p>
                </div>
            </div>
        </div>
    );
}

export default function Sidebar({
                                    tool,
                                    setTool,
                                    stroke,
                                    setStroke,
                                    colors,
                                    selectedElement,
                                    deleteSelected,
                                    toggleSelectedLineCurve,
                                    updateSelectedElementStyle,
                                    canvasProps,
                                    updateCanvasProps,

                                    frames = [],
                                    currentFrameIndex = 0,
                                    onUpdateFrameAudio,
                                    onRemoveFrameAudio,
                                    animationPlaying = false,
                                    animationTimeMs = 0,
                                    playbackSpeed = 0.5,
                                    onPlaybackSpeedChange,
                                    advanceMode = "enter",
                                    onAdvanceModeChange,
                                    onOpenPlayer,
                                    onAddFrameAfter,
                                    onToggleFrameAnimation,
                                    onApplyFrameObjectOrderTiming,
                                    onMergeFrameWithNext,
                                    onMergeAllFrames,
                                    onInsertGifPrimitive,
                                    onInsertEmoji,
                                    onGenerateCodeIllustration,
                                    onSelectFrame,
                                    onDeleteFrame,
                                    onOpenFramesPanel,
                                    focusMode = false,
                                }) {
    const [activeTab, setActiveTab] = useState("draw");
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        try {
            return window.localStorage.getItem("sketchydraw.sidebarCollapsed") !== "true";
        } catch {
            return true;
        }
    });
    const proUser = hasProAccess();

    const setSidebarCollapsed = useCallback((collapsed) => {
        setSidebarOpen(!collapsed);
        try {
            window.localStorage.setItem("sketchydraw.sidebarCollapsed", String(collapsed));
        } catch {}
    }, []);

    useEffect(() => {
        const handleToolbarSidebarRequest = (event) => {
            const section = event?.detail?.section;
            if (!["draw", "properties", "3d", "gif"].includes(section)) return;
            setActiveTab(section);
            setSidebarCollapsed(false);
        };
        window.addEventListener("sketchydraw:open-sidebar-section", handleToolbarSidebarRequest);
        return () => window.removeEventListener("sketchydraw:open-sidebar-section", handleToolbarSidebarRequest);
    }, [setSidebarCollapsed]);

    useEffect(() => {
        if (!selectedElement || selectedElement.id === "__multi__") return;

        if (is3DElement(selectedElement)) {
            setActiveTab("3d");
            return;
        }
        // Normal 2D objects continue to reveal regular properties.
        setActiveTab("properties");
    }, [selectedElement?.id]);

    const chooseTab = (tab, feature) => {
        if (!proUser && feature) {
            requestProUpgrade(feature);
            return;
        }
        setActiveTab(tab);
    };

    const chooseTool = (item) => {
        if (item.premium && !proUser) {
            requestProUpgrade(`${item.label} tool`);
            return;
        }
        setTool(item.id);
    };

    return (
        <>
            <div
                className={`floating-sidebar-host ${focusMode ? "fullscreen-sidebar" : "normal-sidebar"} ${sidebarOpen ? "open" : "closed"}`}
            >
                <div className="floating-sidebar-launcher" aria-label="Quick drawing toolbar">
                    <button
                        type="button"
                        className="floating-sidebar-main-button"
                        onClick={() => setSidebarCollapsed(false)}
                        aria-label="Open drawing tools"
                        title="Open drawing tools"
                    >
                        <PanelLeftOpen size={20} />
                    </button>

                    <div className="floating-sidebar-quick-tools" aria-label="Drawing tools">
                        {TOOLS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={tool === item.id ? "active" : ""}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        chooseTool(item);
                                    }}
                                    title={`${item.label}${item.premium ? " · PRO" : ""}`}
                                >
                                    <Icon size={17} />
                                    {item.premium && <span className="quick-tool-pro-dot" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="sidebar floating-sidebar-panel" aria-hidden={!sidebarOpen}>
                    <div
                        className="sidebar-logo-box"
                    >
                        <div className="sidebar-logo-text">
                            <strong>SketchyDraw</strong>
                            <span>Draw ideas fast</span>
                        </div>
                        <div className="sidebar-display-controls" aria-label="Toolbar display controls">
                            <button
                                type="button"
                                className="sidebar-pin-button sidebar-panel-pin"
                                onClick={() => setSidebarCollapsed(true)}
                                title="Collapse toolbar"
                                aria-label="Collapse toolbar"
                            >
                                <PanelLeftClose size={15} />
                                <span>Collapse</span>
                            </button>
                        </div>
                    </div>

                    <div className="left-toolbar-tabs sidebar-primary-tabs">
                        <button
                            type="button"
                            className={activeTab === "draw" ? "active" : ""}
                            onClick={() => setActiveTab("draw")}
                            title="Choose a drawing tool"
                        >
                            Tools
                        </button>

                        <button
                            type="button"
                            className={activeTab === "properties" ? "active" : ""}
                            onClick={() => setActiveTab("properties")}
                            title="Canvas or selected object properties"
                        >
                            Properties
                        </button>

                        <button
                            type="button"
                            className={activeTab === "3d" ? "active" : ""}
                            onClick={() => setActiveTab("3d")}
                            title="Experimental 3D primitives and characters"
                        >
                            3D
                        </button>

                        <button
                            type="button"
                            className={activeTab === "gif" ? "active" : ""}
                            onClick={() => setActiveTab("gif")}
                            title="GIF and animated drawing tools"
                        >
                            GIF Tools
                        </button>
                    </div>

                    <div className="floating-sidebar-scroll-body">

                        {activeTab === "draw" && (
                            <div className="panel">
                                <h3>Tools</h3>

                                <div className="tool-grid">
                                    {TOOLS.map((item) => {
                                        const Icon = item.icon;

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`tool-btn ${tool === item.id ? "active" : ""}`}
                                                onClick={() => chooseTool(item)}
                                            >
                                                <Icon size={16} />
                                                <span>{item.label}</span>
                                                {item.premium && !proUser && <small className="tool-pro-badge">PRO</small>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === "properties" && (
                            <PropertiesPanel
                                selectedElement={selectedElement}
                                colors={colors}
                                updateSelectedElementStyle={updateSelectedElementStyle}
                                deleteSelected={deleteSelected}
                                toggleSelectedLineCurve={toggleSelectedLineCurve}
                                canvasProps={canvasProps}
                                updateCanvasProps={updateCanvasProps}
                                frames={frames}
                                currentFrameIndex={currentFrameIndex}
                                onUpdateFrameAudio={onUpdateFrameAudio}
                                onRemoveFrameAudio={onRemoveFrameAudio}
                                playbackSpeed={playbackSpeed}
                                onPlaybackSpeedChange={onPlaybackSpeedChange}
                                forcedMode="properties"
                                hideModeTabs
                            />
                        )}


                        {activeTab === "3d" && (
                            <ThreeDTab
                                selectedElement={selectedElement}
                                onInsert={(primitive) => onInsertGifPrimitive?.(to3DInsertRequest(primitive))}
                                onPatch={updateSelectedElementStyle}
                            />
                        )}

                        {activeTab === "gif" && (
                            <GifToolsTab
                                frames={frames}
                                currentFrameIndex={currentFrameIndex}
                                animationPlaying={animationPlaying}
                                animationTimeMs={animationTimeMs}
                                playbackSpeed={playbackSpeed}
                                onPlaybackSpeedChange={onPlaybackSpeedChange}
                                advanceMode={advanceMode}
                                onAdvanceModeChange={onAdvanceModeChange}
                                onAddFrameAfter={onAddFrameAfter}
                                onToggleFrameAnimation={onToggleFrameAnimation}
                                onApplyFrameObjectOrderTiming={onApplyFrameObjectOrderTiming}
                                onMergeFrameWithNext={onMergeFrameWithNext}
                                onMergeAllFrames={onMergeAllFrames}
                                onInsertGifPrimitive={onInsertGifPrimitive}
                            />
                        )}


                    </div>
                </aside>
            </div>
        </>
    );
}
