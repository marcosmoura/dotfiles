import { expect, test } from "bun:test";
import { columnSplitPaths, resolvePlacement, type LayoutNode } from "../src/herdr.js";

function pane(paneID: string): LayoutNode {
  return { type: "pane", pane_id: paneID };
}

function down(first: LayoutNode, second: LayoutNode): LayoutNode {
  return { type: "split", direction: "down", first, second };
}

test("returns the down-split chain under the main pane", () => {
  const root: LayoutNode = {
    type: "split",
    direction: "right",
    first: pane("w1:p1"),
    second: down(pane("w1:p2"), down(pane("w1:p3"), pane("w1:p4"))),
  };

  expect(columnSplitPaths(root, "w1:p1")).toEqual([[true], [true, true]]);
});

test("returns no splits when the column has a single pane", () => {
  const root: LayoutNode = {
    type: "split",
    direction: "right",
    first: pane("w1:p1"),
    second: pane("w1:p2"),
  };

  expect(columnSplitPaths(root, "w1:p1")).toEqual([]);
});

test("returns no splits when the main pane is not the first child", () => {
  const root: LayoutNode = {
    type: "split",
    direction: "right",
    first: pane("w1:other"),
    second: pane("w1:p1"),
  };

  expect(columnSplitPaths(root, "w1:p1")).toEqual([]);
});

test("nests the chain under a deeper main pane path", () => {
  const root: LayoutNode = {
    type: "split",
    direction: "down",
    first: pane("w1:top"),
    second: {
      type: "split",
      direction: "right",
      first: pane("w1:p1"),
      second: down(pane("w1:p2"), down(pane("w1:p3"), pane("w1:p4"))),
    },
  };

  expect(columnSplitPaths(root, "w1:p1")).toEqual([
    [true, true],
    [true, true, true],
  ]);
});

test("splits right when the main pane has no column yet", () => {
  expect(resolvePlacement(pane("w1:p1"), "w1:p1", 0.6)).toEqual({
    anchorPaneID: "w1:p1",
    direction: "right",
    ratio: 0.6,
  });
});

test("stacks down from a single-pane column", () => {
  const singleColumnPane: LayoutNode = {
    type: "split",
    direction: "right",
    first: pane("w1:p1"),
    second: pane("w1:p2"),
  };
  expect(resolvePlacement(singleColumnPane, "w1:p1", 0.6)).toEqual({
    anchorPaneID: "w1:p2",
    direction: "down",
  });
});

test("stacks down from the bottom of an existing column", () => {
  const root: LayoutNode = {
    type: "split",
    direction: "right",
    first: pane("w1:p1"),
    second: down(pane("w1:p2"), down(pane("w1:p3"), pane("w1:p4"))),
  };

  expect(resolvePlacement(root, "w1:p1", 0.6)).toEqual({
    anchorPaneID: "w1:p4",
    direction: "down",
  });
});

test("falls back to a right split when the main pane is not the first child", () => {
  const root: LayoutNode = {
    type: "split",
    direction: "right",
    first: pane("w1:other"),
    second: pane("w1:p1"),
  };

  expect(resolvePlacement(root, "w1:p1", 0.6)).toEqual({
    anchorPaneID: "w1:p1",
    direction: "right",
    ratio: 0.6,
  });
});
