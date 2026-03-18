import { assertNever } from './assert-never';

describe('assertNever', () => {
  it('should throw an error with the unexpected value in the message', () => {
    expect(() => assertNever('unexpected' as never)).toThrowError('Unexpected value: unexpected');
  });

  it('should throw an error for any value passed as never', () => {
    expect(() => assertNever(42 as never)).toThrowError('Unexpected value: 42');
    expect(() => assertNever(null as never)).toThrowError('Unexpected value: null');
    expect(() => assertNever(undefined as never)).toThrowError('Unexpected value: undefined');
  });
});
