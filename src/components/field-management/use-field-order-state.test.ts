import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldOrderState } from './use-field-order-state';
import type { PageField } from './types';

const OTHER = '99 - Other Fields';

function makeField(overrides: Partial<PageField> & { Page_Field_ID: number; Field_Name: string }): PageField {
  return {
    Page_Field_ID: overrides.Page_Field_ID,
    Page_ID: 1,
    Field_Name: overrides.Field_Name,
    Group_Name: overrides.Group_Name ?? '1 - General',
    View_Order: overrides.View_Order ?? 1,
    Required: overrides.Required ?? false,
    Hidden: overrides.Hidden ?? false,
    Default_Value: null,
    Filter_Clause: null,
    Depends_On_Field: null,
    Field_Label: null,
    Writing_Assistant_Enabled: false,
    isSeparator: overrides.isSeparator ?? false,
  };
}

describe('useFieldOrderState > hideAllSeparators', () => {
  it('flips Hidden to true and moves separators to "99 - Other Fields"', () => {
    const fields: PageField[] = [
      makeField({ Page_Field_ID: 1, Field_Name: 'First_Name', Group_Name: '1 - General', View_Order: 1 }),
      makeField({ Page_Field_ID: 2, Field_Name: 'Sep_A', Group_Name: '1 - General', View_Order: 2, isSeparator: true }),
      makeField({ Page_Field_ID: 3, Field_Name: 'Last_Name', Group_Name: '2 - Name', View_Order: 3 }),
      makeField({ Page_Field_ID: 4, Field_Name: 'Sep_B', Group_Name: '2 - Name', View_Order: 4, isSeparator: true }),
    ];
    const { result } = renderHook(() => useFieldOrderState(fields));

    act(() => {
      result.current.hideAllSeparators();
    });

    expect(result.current.fieldLookup.get(2)?.Hidden).toBe(true);
    expect(result.current.fieldLookup.get(4)?.Hidden).toBe(true);
    expect(result.current.fieldLookup.get(1)?.Hidden).toBe(false);
    expect(result.current.fieldLookup.get(3)?.Hidden).toBe(false);

    expect(result.current.groupedFields['1 - General']).toEqual([1]);
    expect(result.current.groupedFields['2 - Name']).toEqual([3]);
    expect(result.current.groupedFields[OTHER]).toEqual([2, 4]);
    expect(result.current.groupOrder[result.current.groupOrder.length - 1]).toBe(OTHER);
    expect(result.current.isDirty).toBe(true);
  });

  it('preserves existing "Other" fields ahead of newly-moved separators', () => {
    const fields: PageField[] = [
      makeField({ Page_Field_ID: 10, Field_Name: 'Existing_Other', Group_Name: OTHER, View_Order: 1 }),
      makeField({ Page_Field_ID: 11, Field_Name: 'Sep_X', Group_Name: '1 - General', View_Order: 2, isSeparator: true }),
    ];
    const { result } = renderHook(() => useFieldOrderState(fields));

    act(() => {
      result.current.hideAllSeparators();
    });

    expect(result.current.groupedFields[OTHER]).toEqual([10, 11]);
  });

  it('no-ops when no separators exist', () => {
    const fields: PageField[] = [
      makeField({ Page_Field_ID: 1, Field_Name: 'First_Name', Group_Name: '1 - General', View_Order: 1 }),
    ];
    const { result } = renderHook(() => useFieldOrderState(fields));

    act(() => {
      result.current.hideAllSeparators();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.fieldLookup.get(1)?.Hidden).toBe(false);
  });

  it('handles auto-injected separators with negative Page_Field_IDs', () => {
    const fields: PageField[] = [
      makeField({ Page_Field_ID: 1, Field_Name: 'First_Name', Group_Name: '1 - General', View_Order: 1 }),
      makeField({ Page_Field_ID: -1, Field_Name: 'Sep_Injected', Group_Name: null, View_Order: 2, isSeparator: true }),
    ];
    const { result } = renderHook(() => useFieldOrderState(fields));

    act(() => {
      result.current.hideAllSeparators();
    });

    expect(result.current.fieldLookup.get(-1)?.Hidden).toBe(true);
    expect(result.current.groupedFields[OTHER]).toContain(-1);
  });

  it('flips Hidden values so buildSavePayload persists Hidden=true for separators', () => {
    const fields: PageField[] = [
      makeField({ Page_Field_ID: 1, Field_Name: 'First_Name', Group_Name: '1 - General', View_Order: 1 }),
      makeField({ Page_Field_ID: 2, Field_Name: 'Sep_A', Group_Name: '1 - General', View_Order: 2, isSeparator: true }),
    ];
    const { result } = renderHook(() => useFieldOrderState(fields));

    act(() => {
      result.current.hideAllSeparators();
    });

    const payload = result.current.buildSavePayload();
    const sep = payload.find((p) => p.Field_Name === 'Sep_A');
    expect(sep?.Hidden).toBe(true);
    expect(sep?.Group_Name).toBe(OTHER);
  });
});
