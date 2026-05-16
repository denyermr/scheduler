import { describe, it, expect } from 'vitest';
import * as types from '../../src/domain/types';

describe('domain/types', () => {
  it('module loads and is importable', () => {
    expect(types).toBeDefined();
  });
});
