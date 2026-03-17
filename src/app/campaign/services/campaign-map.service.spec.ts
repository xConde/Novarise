import { TestBed } from '@angular/core/testing';
import { CampaignMapService } from './campaign-map.service';
import { CAMPAIGN_LEVELS } from '../models/campaign.model';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';

describe('CampaignMapService', () => {
  let service: CampaignMapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CampaignMapService);
  });

  // ── loadLevel — happy path ────────────────────────────────────────────────

  it('should return a TerrainGridState for every campaign level', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id);
      expect(state).not.toBeNull(`Expected a map for ${level.id}`);
    }
  });

  it('should return null for an unknown level id', () => {
    expect(service.loadLevel('campaign_99')).toBeNull();
    expect(service.loadLevel('')).toBeNull();
  });

  // ── gridSize ──────────────────────────────────────────────────────────────

  it('should produce a map whose gridSize matches the level config', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.gridSize).toBe(level.gridSize, `gridSize mismatch for ${level.id}`);
    }
  });

  it('should produce a tiles array with correct dimensions', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.tiles.length).toBe(level.gridSize, `tiles x-dim for ${level.id}`);
      for (let x = 0; x < level.gridSize; x++) {
        expect(state.tiles[x].length).toBe(level.gridSize, `tiles z-dim at x=${x} for ${level.id}`);
      }
    }
  });

  it('should produce a heightMap with correct dimensions', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.heightMap.length).toBe(level.gridSize);
      for (let x = 0; x < level.gridSize; x++) {
        expect(state.heightMap[x].length).toBe(level.gridSize);
      }
    }
  });

  // ── terrain ───────────────────────────────────────────────────────────────

  it('should return hand-crafted maps (non-all-BEDROCK) for all 16 levels', () => {
    const handCraftedIds = [
      'campaign_01', 'campaign_02', 'campaign_03', 'campaign_04',
      'campaign_05', 'campaign_06', 'campaign_07', 'campaign_08',
      'campaign_09', 'campaign_10', 'campaign_11', 'campaign_12',
      'campaign_13', 'campaign_14', 'campaign_15', 'campaign_16',
    ];
    for (const id of handCraftedIds) {
      const state = service.loadLevel(id)!;
      // Hand-crafted maps use ABYSS/CRYSTAL/MOSS — not purely BEDROCK
      let hasNonBedrock = false;
      for (let x = 0; x < state.gridSize; x++) {
        for (let z = 0; z < state.gridSize; z++) {
          if (state.tiles[x][z] !== TerrainType.BEDROCK) {
            hasNonBedrock = true;
          }
        }
      }
      expect(hasNonBedrock).withContext(`Level ${id} should use non-BEDROCK tiles`).toBeTrue();
    }
  });

  // ── spawnPoints / exitPoints ───────────────────────────────────────────────

  it('should have at least one spawnPoint per level', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.spawnPoints.length).toBeGreaterThan(0, `No spawnPoints for ${level.id}`);
    }
  });

  it('should have at least one exitPoint per level', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.exitPoints.length).toBeGreaterThan(0, `No exitPoints for ${level.id}`);
    }
  });

  it('should generate spawnPoint counts matching level spawnerCount', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.spawnPoints.length).toBe(
        level.spawnerCount,
        `spawnerCount mismatch for ${level.id}`,
      );
    }
  });

  it('should generate exitPoint counts matching level exitCount', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      expect(state.exitPoints.length).toBe(
        level.exitCount,
        `exitCount mismatch for ${level.id}`,
      );
    }
  });

  it('should produce spawnPoints within the grid bounds', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      for (const sp of state.spawnPoints) {
        expect(sp.x).toBeGreaterThanOrEqual(0);
        expect(sp.x).toBeLessThan(state.gridSize);
        expect(sp.z).toBeGreaterThanOrEqual(0);
        expect(sp.z).toBeLessThan(state.gridSize);
      }
    }
  });

  it('should produce exitPoints within the grid bounds', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const state = service.loadLevel(level.id)!;
      for (const ep of state.exitPoints) {
        expect(ep.x).toBeGreaterThanOrEqual(0);
        expect(ep.x).toBeLessThan(state.gridSize);
        expect(ep.z).toBeGreaterThanOrEqual(0);
        expect(ep.z).toBeLessThan(state.gridSize);
      }
    }
  });

  // ── version ───────────────────────────────────────────────────────────────

  it('should set version to 2.0.0', () => {
    const state = service.loadLevel('campaign_01')!;
    expect(state.version).toBe('2.0.0');
  });
});
