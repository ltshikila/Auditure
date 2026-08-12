/*
 * Fired by "Open at Random" in the hero. The Listen section owns the audio
 * elements, so it listens for this, scrolls itself into view and starts a
 * random episode. A plain CustomEvent keeps the two sections decoupled without
 * dragging in a store for one interaction.
 */
export const RANDOM_EPISODE_EVENT = 'auditure:play-random-episode';
