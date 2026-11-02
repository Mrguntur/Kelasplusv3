import { validateSync } from 'class-validator';
import { AssignTrialSubscriptionDto, UpdatePlanDto } from './plan.dto';

describe('Billing DTO validation', () => {
  it('accepts a three-letter currency when updating a plan', () => {
    const dto = Object.assign(new UpdatePlanDto(), { currency: 'IDR' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects malformed currency values when updating a plan', () => {
    const dto = Object.assign(new UpdatePlanDto(), { currency: 'IDRP' });
    expect(validateSync(dto).some((error) => error.property === 'currency')).toBe(true);
  });

  it('accepts a trial duration within the supported 1–90 day range', () => {
    const dto = Object.assign(new AssignTrialSubscriptionDto(), {
      schoolId: 'a4d2b1b0-0c7f-4d7d-8c5d-3c9b2e0b7a11',
      planId: 'b4d2b1b0-0c7f-4d7d-8c5d-3c9b2e0b7a22',
      trialDays: 14,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([0, 91])('rejects trial duration %i outside the supported range', (trialDays) => {
    const dto = Object.assign(new AssignTrialSubscriptionDto(), {
      schoolId: 'a4d2b1b0-0c7f-4d7d-8c5d-3c9b2e0b7a11',
      planId: 'b4d2b1b0-0c7f-4d7d-8c5d-3c9b2e0b7a22',
      trialDays,
    });
    expect(validateSync(dto).some((error) => error.property === 'trialDays')).toBe(true);
  });

  it('rejects non-UUID school and plan identifiers', () => {
    const dto = Object.assign(new AssignTrialSubscriptionDto(), {
      schoolId: 'school-1',
      planId: 'plan-1',
      trialDays: 14,
    });
    const errors = validateSync(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['schoolId', 'planId']));
  });
});
