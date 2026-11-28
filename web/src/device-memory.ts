// Remove the topic cookie left by earlier browser-only sessions.
export function clearMemory() {
  document.cookie='momo_topic=; Path=/; SameSite=Strict; Max-Age=0'+(location.protocol==='https:'?'; Secure':'');
}
