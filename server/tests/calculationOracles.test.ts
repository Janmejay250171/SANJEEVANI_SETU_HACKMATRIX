import { describe, it, expect } from 'vitest';
import {
  INDEPENDENT_CALCULATION_ORACLES,
  computeIndependentOracleMath,
  IndependentOracleFixture
} from '../src/evaluation/independentCalculationOracle.js';

describe('FIN-01 Independent Calculation Oracles Test Suite (Prompt 7)', () => {
  it('Verifies that all 20 calculation oracle fixtures satisfy the exact mathematical balance invariant', () => {
    for (const fixture of INDEPENDENT_CALCULATION_ORACLES) {
      const {
        totalClaimedPaise,
        finalInsurerPayablePaise,
        totalPatientResponsibilityPaise,
        isMathematicallyBalanced
      } = computeIndependentOracleMath(fixture.items, fixture.rules, fixture.policySumInsuredPaise);

      expect(isMathematicallyBalanced).toBe(true);
      expect(totalClaimedPaise).toBe(finalInsurerPayablePaise + totalPatientResponsibilityPaise);
    }
  });

  it('Verifies non-negative payable invariant across all fixtures including adversarial negative inputs', () => {
    for (const fixture of INDEPENDENT_CALCULATION_ORACLES) {
      const { finalInsurerPayablePaise } = computeIndependentOracleMath(
        fixture.items,
        fixture.rules,
        fixture.policySumInsuredPaise
      );
      expect(finalInsurerPayablePaise).toBeGreaterThanOrEqual(0);
    }
  });

  it('Verifies integer minor unit precision (no fractional float decimals) across all 20 fixtures', () => {
    for (const fixture of INDEPENDENT_CALCULATION_ORACLES) {
      const result = computeIndependentOracleMath(fixture.items, fixture.rules, fixture.policySumInsuredPaise);
      expect(Number.isInteger(result.totalClaimedPaise)).toBe(true);
      expect(Number.isInteger(result.excludedNonPayablePaise)).toBe(true);
      expect(Number.isInteger(result.roomRentExcessPaise)).toBe(true);
      expect(Number.isInteger(result.proportionateDisallowancePaise)).toBe(true);
      expect(Number.isInteger(result.appliedDeductiblePaise)).toBe(true);
      expect(Number.isInteger(result.appliedCopayPaise)).toBe(true);
      expect(Number.isInteger(result.finalInsurerPayablePaise)).toBe(true);
      expect(Number.isInteger(result.totalPatientResponsibilityPaise)).toBe(true);
    }
  });

  it('Scenario 01 (Fully Supported): Pays 100% of claimed amount without deduction', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_01_fully_supported')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.finalInsurerPayablePaise).toBe(5000000);
    expect(res.totalPatientResponsibilityPaise).toBe(0);
  });

  it('Scenario 02 (Excluded Item): 100% of non-payable & excluded amounts allocated to patient', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_02_excluded_item')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.finalInsurerPayablePaise).toBe(0);
    expect(res.totalPatientResponsibilityPaise).toBe(7700000);
    expect(res.excludedNonPayablePaise).toBe(7700000);
  });

  it('Scenario 03 (Partially Admissible Room Rent): Daily excess accurately disallows 3 days of excess', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_03_room_rent_cap')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.roomRentExcessPaise).toBe(900000);
    expect(res.finalInsurerPayablePaise).toBe(1500000);
    expect(res.totalPatientResponsibilityPaise).toBe(900000);
  });

  it('Scenario 06 (Aggregate Deductible): Applies deductible at claim level', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_06_claim_deductible')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.appliedDeductiblePaise).toBe(1500000);
    expect(res.finalInsurerPayablePaise).toBe(4500000);
  });

  it('Scenario 07 (Co-payment Base Precedence): Computes copay on post-deductible base', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_07_copay_on_deductible')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.appliedDeductiblePaise).toBe(2000000);
    expect(res.appliedCopayPaise).toBe(800000); // 10% on ₹80,000
    expect(res.finalInsurerPayablePaise).toBe(7200000);
    expect(res.totalPatientResponsibilityPaise).toBe(2800000);
  });

  it('Scenario 09 (Explicit Proportionate Deduction): Disallows proportional fraction of associated fees', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_09_explicit_proportionate')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.roomRentExcessPaise).toBe(1000000);
    expect(res.proportionateDisallowancePaise).toBe(3500000);
    expect(res.finalInsurerPayablePaise).toBe(4500000);
    expect(res.totalPatientResponsibilityPaise).toBe(4500000);
  });

  it('Scenario 10 (Procedure Sublimit): Enforces statutory or contractual procedure sublimit', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_10_sublimit_cap')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.sublimitDisallowancePaise).toBe(2500000);
    expect(res.finalInsurerPayablePaise).toBe(4000000);
  });

  it('Scenario 16 (Double Deduction Protection): Never applies co-payment to already excluded items', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_16_prevent_double_deduction')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.excludedNonPayablePaise).toBe(2000000);
    expect(res.appliedCopayPaise).toBe(800000); // 20% on admissible ₹40,000 only
    expect(res.finalInsurerPayablePaise).toBe(3200000);
    expect(res.totalPatientResponsibilityPaise).toBe(2800000);
  });

  it('Scenario 19 (Minor Unit Rounding): Ensures exact integer paisa rounding without half-paisa drift', () => {
    const f = INDEPENDENT_CALCULATION_ORACLES.find(x => x.fixtureId === 'orc_19_minor_unit_rounding')!;
    const res = computeIndependentOracleMath(f.items, f.rules, f.policySumInsuredPaise);
    expect(res.totalClaimedPaise).toBe(155555);
    expect(res.appliedCopayPaise).toBe(23333);
    expect(res.finalInsurerPayablePaise).toBe(132222);
    expect(res.totalPatientResponsibilityPaise).toBe(23333);
    expect(res.finalInsurerPayablePaise + res.totalPatientResponsibilityPaise).toBe(155555);
  });
});
