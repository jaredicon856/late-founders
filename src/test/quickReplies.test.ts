import { describe, expect, it } from "vitest";
import { splitReplies } from "@/lib/quickReplies";

describe("quick replies", () => {
  it("pulls the reply buttons off the end of a message", () => {
    expect(splitReplies("Does this look right?\n\n[[Yes, that's right. Save it | I want to change something]]")).toEqual({
      body: "Does this look right?",
      replies: ["Yes, that's right. Save it", "I want to change something"],
    });
  });
  it("leaves ordinary messages alone", () => {
    expect(splitReplies("What are your monthly costs?")).toEqual({ body: "What are your monthly costs?", replies: [] });
  });
  it("caps the number of buttons at four", () => {
    expect(splitReplies("Pick one.\n[[a | b | c | d | e]]").replies).toHaveLength(4);
  });
});
