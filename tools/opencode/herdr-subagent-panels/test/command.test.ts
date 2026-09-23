import { expect, test } from "bun:test";
import { opencodeCommand, shellQuote } from "../src/command.js";

test("quotes values for a POSIX shell", () => {
  expect(shellQuote("ses_abc123")).toBe("'ses_abc123'");
  expect(shellQuote("a b")).toBe("'a b'");
  expect(shellQuote("it's")).toBe("'it'\\''s'");
});

test("builds an opencode command that reopens a child session", () => {
  expect(opencodeCommand("ses_child", "/opt/opencode/bin/opencode")).toBe(
    "'/opt/opencode/bin/opencode' --session 'ses_child'",
  );
});
