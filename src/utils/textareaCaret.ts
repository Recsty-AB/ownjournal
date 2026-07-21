// Measures the pixel position of a character index inside a <textarea> using
// the mirror-div technique: an off-screen div is given the textarea's layout
// styles and its text up to the caret, and a marker span at the end lands at
// the caret's coordinates.

const MIRROR_STYLE_PROPS = [
  "direction",
  "boxSizing",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export interface CaretRect {
  /** Offset from the textarea's top edge, scroll-adjusted. */
  top: number;
  /** Offset from the textarea's left edge, scroll-adjusted. */
  left: number;
  /** Line height at the caret, for placing UI below the current line. */
  height: number;
}

export const getTextareaCaretRect = (
  textarea: HTMLTextAreaElement,
  position: number
): CaretRect => {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  for (const prop of MIRROR_STYLE_PROPS) {
    mirror.style[prop as any] = style[prop as any];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${textarea.clientWidth}px`;

  mirror.textContent = textarea.value.substring(0, position);

  const marker = document.createElement("span");
  // A zero-width-ish placeholder so the span has layout at line ends.
  marker.textContent = "​";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const lineHeight =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4 || 20;
  const rect: CaretRect = {
    top: marker.offsetTop + parseFloat(style.borderTopWidth || "0") - textarea.scrollTop,
    left: marker.offsetLeft + parseFloat(style.borderLeftWidth || "0") - textarea.scrollLeft,
    height: lineHeight,
  };
  document.body.removeChild(mirror);
  return rect;
};
