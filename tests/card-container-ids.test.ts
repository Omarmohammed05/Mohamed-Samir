import { describe, it, expect } from 'vitest';
import {
  parseCardTabData,
  resolveContainerIds,
  buildMatrixRows,
} from '@/lib/card-sheets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function containerRows(count: number): string[][] {
  return Array.from({ length: count }, (_, i) => [
    i === 0 ? 'Group A' : '', // equipment label only on the first column of a group
    `TAG-${i + 1}`,
    '%',
    `Container ${i + 1}`,
    '0',
    '50',
    '100',
    '',
    '',
  ]);
}

describe('container ID resolution (resolveContainerIds)', () => {
  it('generates a UUID once for a new container', () => {
    const [row] = resolveContainerIds([['Group A', 'NEW-1', '%', 'd', '0', '50', '100', '']], new Map());
    expect(UUID_RE.test(row[8])).toBe(true);
    expect(row[7]).toBe(''); // hidden flag preserved as sent
  });

  it('reuses the sheet ID for the same tag — never regenerates on rewrite', () => {
    const existing = new Map([['TAG-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']]);
    const [row] = resolveContainerIds([['Group A', 'TAG-1', '%', 'd', '0', '50', '100', '']], existing);
    expect(row[8]).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('keeps the ID the row already carries, even if the tag changed', () => {
    const [row] = resolveContainerIds(
      [['Group A', 'RENAMED-9', '%', 'd', '0', '50', '100', '', 'my-fixed-id']],
      new Map(),
    );
    expect(row[8]).toBe('my-fixed-id');
  });

  it('backfills the hidden flag when the caller sends only 7 columns', () => {
    const [row] = resolveContainerIds([['Group A', 'T', '%', 'd', '0', '50', '100']], new Map());
    expect(row.length).toBe(9);
    expect(row[7]).toBe('');
    expect(UUID_RE.test(row[8])).toBe(true);
  });

  it('aborts with a sync error on a duplicate ID (collision)', () => {
    expect(() =>
      resolveContainerIds(
        [
          ['A', 'T1', '%', 'd', '0', '50', '100', '', 'same-id'],
          ['A', 'T2', '%', 'd', '0', '50', '100', '', 'same-id'],
        ],
        new Map(),
      ),
    ).toThrow(/Duplicate container ID/);
  });

  it('a retried save is idempotent — same ID in, same ID out', () => {
    const first = resolveContainerIds([['A', 'T1', '%', 'd', '0', '50', '100', '']], new Map());
    const retry = resolveContainerIds(
      [['A', 'T1', '%', 'd', '0', '50', '100', '']],
      new Map([['T1', first[0][8]]]),
    );
    expect(retry[0][8]).toBe(first[0][8]);
  });
});

describe('ID row round trip (buildMatrixRows → parseCardTabData)', () => {
  it('writes an ID row and reads the IDs back after a save', () => {
    const rows = resolveContainerIds(containerRows(3), new Map());
    const matrix = buildMatrixRows(rows, [
      ['Alice', '2026-10-17', '10:00', '5', '', '', '1', '2', '3', ''],
    ]);

    // Row layout: 0..6 headers/min-max, 7 hidden, 8 ID, 9 user header, 10+ submissions
    expect(matrix[8][0]).toBe('ID');
    expect(matrix[9][0]).toBe('User');

    const { containers, submissions } = parseCardTabData(matrix);
    expect(containers).toHaveLength(3);
    for (const c of containers) expect(UUID_RE.test(c.id)).toBe(true);
    // Submissions land below the User header and map values by tag
    expect(submissions.get('2026-10-17 10:00')?.get('TAG-2')).toBe('2');
  });

  it('a sheet without an ID row parses with empty IDs (pre-migration state)', () => {
    const matrix = buildMatrixRows(containerRows(2).map((r) => r.slice(0, 8)), []);
    // Simulate the old layout: drop the ID row
    const legacy = matrix.filter((r) => r[0] !== 'ID');
    const { containers } = parseCardTabData(legacy);
    expect(containers).toHaveLength(2);
    for (const c of containers) expect(c.id).toBe('');
  });

  it('identity follows the container across row/column reordering', () => {
    const rows = resolveContainerIds(containerRows(3), new Map());
    const idsBefore = rows.map((r) => r[8]);

    // Reorder: move the last container to the front, as a sheet cleanup would
    // (columns may regroup by equipment — order can change, identity may not)
    const reordered = [rows[2], rows[0], rows[1]];
    const parsed = parseCardTabData(buildMatrixRows(reordered, []));

    const idByTag = new Map(parsed.containers.map((c) => [c.tagNo, c.id]));
    expect(idByTag.get('TAG-1')).toBe(idsBefore[0]);
    expect(idByTag.get('TAG-2')).toBe(idsBefore[1]);
    expect(idByTag.get('TAG-3')).toBe(idsBefore[2]);
  });

  it('duplicate tags stay distinct containers with distinct IDs', () => {
    const rows = resolveContainerIds(
      [
        ['A', 'SAME-TAG', '%', 'first', '0', '50', '100', ''],
        ['A', 'SAME-TAG', '%', 'second', '0', '50', '100', ''],
      ],
      new Map(),
    );
    expect(rows[0][8]).not.toBe(rows[1][8]);
    const { containers } = parseCardTabData(buildMatrixRows(rows, []));
    expect(containers).toHaveLength(2);
    expect(containers[0].id).not.toBe(containers[1].id);
  });
});
