import { describe, it, expect } from "vitest";
import {
  extractInlineTags,
  mergeInlineTags,
  getActiveTagToken,
} from "../inlineTags";

describe("extractInlineTags", () => {
  it("extracts simple tags", () => {
    expect(extractInlineTags("Worked on #projectx today with #alice")).toEqual([
      "projectx",
      "alice",
    ]);
  });

  it("extracts tags at line start and end of text", () => {
    expect(extractInlineTags("#work\nsome text #personal")).toEqual([
      "work",
      "personal",
    ]);
  });

  it("supports unicode letters and hyphens", () => {
    expect(extractInlineTags("Tagebuch #übung and #日記 plus #side-project")).toEqual([
      "übung",
      "日記",
      "side-project",
    ]);
  });

  it("dedupes case-insensitively keeping first casing", () => {
    expect(extractInlineTags("#Work then #work and #WORK")).toEqual(["Work"]);
  });

  it("ignores markdown headings", () => {
    expect(extractInlineTags("# Heading\n## Subheading\ntext")).toEqual([]);
  });

  it("ignores URL fragments and mid-word hashes", () => {
    expect(
      extractInlineTags("see https://example.com/page#section and foo#bar")
    ).toEqual([]);
  });

  it("ignores hashes inside fenced code blocks and inline code", () => {
    const body = "```sh\n# comment\necho #nope\n```\nuse `#notatag` but #real";
    expect(extractInlineTags(body)).toEqual(["real"]);
  });

  it("ignores bare # and #- tokens", () => {
    expect(extractInlineTags("just # alone and #- dash")).toEqual([]);
  });

  it("caps tag length at 30 characters", () => {
    const long = "a".repeat(40);
    expect(extractInlineTags(`#${long}`)[0]).toHaveLength(30);
  });

  it("returns empty array for empty or hash-free body", () => {
    expect(extractInlineTags("")).toEqual([]);
    expect(extractInlineTags("no tags here")).toEqual([]);
  });
});

describe("mergeInlineTags", () => {
  it("appends new inline tags after explicit tags", () => {
    expect(mergeInlineTags(["home"], "did #work and #gym")).toEqual([
      "home",
      "work",
      "gym",
    ]);
  });

  it("does not duplicate existing tags (case-insensitive)", () => {
    expect(mergeInlineTags(["Work"], "more #work today")).toEqual(["Work"]);
  });

  it("respects the max tag cap", () => {
    const tags = Array.from({ length: 19 }, (_, i) => `t${i}`);
    const merged = mergeInlineTags(tags, "#extra1 #extra2");
    expect(merged).toHaveLength(20);
    expect(merged).toContain("extra1");
    expect(merged).not.toContain("extra2");
  });

  it("leaves tags untouched when body has no inline tags", () => {
    expect(mergeInlineTags(["a"], "plain text")).toEqual(["a"]);
  });
});

describe("getActiveTagToken", () => {
  it("detects a token being typed at the caret", () => {
    const text = "hello #wor";
    expect(getActiveTagToken(text, text.length)).toEqual({
      start: 6,
      query: "wor",
    });
  });

  it("detects a bare # with empty query", () => {
    const text = "hello #";
    expect(getActiveTagToken(text, text.length)).toEqual({
      start: 6,
      query: "",
    });
  });

  it("detects a token at line start", () => {
    const text = "line1\n#ta";
    expect(getActiveTagToken(text, text.length)).toEqual({
      start: 6,
      query: "ta",
    });
  });

  it("returns null when caret is not in a tag token", () => {
    const text = "hello world";
    expect(getActiveTagToken(text, text.length)).toBeNull();
  });

  it("returns null for URL fragments", () => {
    const text = "https://x.com/#sec";
    expect(getActiveTagToken(text, text.length)).toBeNull();
  });

  it("returns null once a space ends the token", () => {
    const text = "#work ";
    expect(getActiveTagToken(text, text.length)).toBeNull();
  });

  it("returns null for over-long tokens", () => {
    const text = "#" + "a".repeat(31);
    expect(getActiveTagToken(text, text.length)).toBeNull();
  });
});
