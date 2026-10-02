import { useEffect, useRef, useState } from "react";

export default function useNarrationRecording(open) {
    const [recording, setRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState("");
    const [error, setError] = useState("");
    const [audioName, setAudioName] = useState("sketchydraw-narration.webm");
    const session = useRef(null);
    const generation = useRef(0);
    const urlRef = useRef("");
    const replace = (url) => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setAudioUrl(url);
    };
    const stop = () => {
        generation.current += 1;
        const current = session.current;
        if (current?.recorder.state !== "inactive") current?.recorder.stop();
        current?.stream.getTracks().forEach(track => track.stop());
        session.current = null;
        if (!current) setRecording(false);
    };
    const start = async (play) => {
        if (session.current) return;
        const token = ++generation.current;
        setError("");
        let stream;
        try {
            if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
                throw new Error("Microphone recording needs HTTPS or localhost and a supported browser.");
            }
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
            if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
            const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            const chunks = [];
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                const blob = new Blob(chunks, { type: recorder.mimeType });
                if (blob.size) {
                    setAudioName(`sketchydraw-narration.${recorder.mimeType.includes("mp4") ? "m4a" : "webm"}`);
                    replace(URL.createObjectURL(blob));
                }
                setRecording(false);
            };
            recorder.onerror = () => { setError("Microphone recording failed. Please retry."); stop(); };
            session.current = { stream, recorder };
            recorder.start(250);
            setRecording(true);
            play?.();
        } catch (failure) {
            stream?.getTracks().forEach(track => track.stop());
            setRecording(false);
            setError(failure.message || "Could not record microphone audio.");
        }
    };
    useEffect(() => { if (!open) stop(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => {
        generation.current += 1;
        const current = session.current;
        if (current) { current.recorder.onstop = null; if (current.recorder.state !== "inactive") current.recorder.stop(); current.stream.getTracks().forEach(track => track.stop()); }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);
    return { recording, audioUrl, audioName, error, start, stop, clear: () => replace(""), load: file => { setAudioName(file.name); replace(URL.createObjectURL(file)); } };
}
