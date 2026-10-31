// Splits invitation wording such as "… {field}، …" into plain text and blanks.
// Punctuation that directly follows a blank is returned with it as `tail`, so a
// layout can keep the two together and never wrap the comma onto its own line.
export function splitWording(text) {
  return text.split(/(\{[^}]+\}[،.]?)/).map((part) => {
    if (!part.startsWith('{')) return { text: part };
    const end = part.indexOf('}');
    return { blank: part.slice(1, end), tail: part.slice(end + 1) };
  });
}
