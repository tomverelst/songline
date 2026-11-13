/** Says `text` out loud with the phone's own voice, cutting off anything still being said. */
export function say(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  speechSynthesis.speak(utterance)
}

/**
 * iPhones only let a page speak once it spoke from a tap: call this from one
 * (e.g. Start) so later announcements work by themselves.
 */
export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return
  const silent = new SpeechSynthesisUtterance('')
  silent.volume = 0
  speechSynthesis.speak(silent)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
