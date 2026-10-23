import { describe, it, expect } from "vitest";
import { DEFAULT_DESIGN, describeDesign, normaliseDesign } from "@/lib/cake3d/design";

describe("3D cake designer options", () => {
  it("describes a design in plain English for the page and the WhatsApp enquiry", () => {
    expect(describeDesign({ tiers: 3, frosting: "chocolate", drip: "gold", topping: "rosettes" }))
      .toBe("3 tiers with chocolate frosting, a gold drip and piped rosettes");
    expect(describeDesign({ tiers: 1, frosting: "pistachio", drip: "none", topping: "gold-leaf" }))
      .toBe("1 tier with pistachio frosting and gold leaf");
    expect(describeDesign({ tiers: 2, frosting: "ivory", drip: "none", topping: "none" }))
      .toBe("2 tiers with ivory frosting");
    expect(describeDesign({ tiers: 1, frosting: "burgundy", drip: "mirror", topping: "gold-leaf" }))
      .toBe("1 tier in a burgundy marble mirror glaze, finished with gold leaf");
  });

  it("falls back to safe defaults for unknown or tampered values", () => {
    expect(normaliseDesign({ tiers: "9", frosting: "<script>", drip: 1, topping: undefined })).toEqual(DEFAULT_DESIGN);
    expect(normaliseDesign({ tiers: "3", frosting: "burgundy", drip: "chocolate", topping: "berries" }))
      .toEqual({ tiers: 3, frosting: "burgundy", drip: "chocolate", topping: "berries" });
  });
});
