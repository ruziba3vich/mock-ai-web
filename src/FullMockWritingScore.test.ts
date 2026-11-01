import {expect,it} from "vitest";
import {weightedWritingBand} from "./FullMockWritingScore";
it("weights Task 2 twice and rounds only the combined estimate",()=>{
 expect(weightedWritingBand(5,8)).toBe(7);
 expect(weightedWritingBand(8,5)).toBe(6);
 expect(weightedWritingBand(6,6.5)).toBe(6.5);
});
