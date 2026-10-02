// Route narration into MediaRecorder without playing it through the speakers.
export async function attachExportAudio(stream, source, playbackRate = 1) {
    if (!source) return { start() {}, async dispose() {} };
    const context = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const response = await fetch(source);
        if (!response.ok) throw new Error("Could not load narration audio.");
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        const node = context.createBufferSource();
        node.buffer = buffer;
        node.playbackRate.value = playbackRate;
        const destination = context.createMediaStreamDestination();
        node.connect(destination);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        await context.resume();
        return {
            start() { node.start(); },
            async dispose() {
                try { node.stop(); } catch (_) {}
                node.disconnect();
                destination.stream.getTracks().forEach(track => track.stop());
                await context.close();
            },
        };
    } catch (error) {
        await context.close();
        throw error;
    }
}
