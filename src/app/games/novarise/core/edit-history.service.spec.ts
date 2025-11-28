import { TestBed } from '@angular/core/testing';
import {
  EditHistoryService,
  EditCommand,
  PaintCommand,
  HeightCommand,
  SpawnPointCommand,
  ExitPointCommand,
  CompositeCommand,
  TileState,
  GridPoint
} from './edit-history.service';
import { TerrainType } from '../models/terrain-types.enum';

describe('EditHistoryService', () => {
  let service: EditHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EditHistoryService]
    });
    service = TestBed.inject(EditHistoryService);
  });

  describe('Initial State', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with empty undo stack', () => {
      expect(service.canUndo).toBe(false);
      expect(service.undoCount).toBe(0);
    });

    it('should start with empty redo stack', () => {
      expect(service.canRedo).toBe(false);
      expect(service.redoCount).toBe(0);
    });

    it('should have null descriptions when stacks are empty', () => {
      expect(service.nextUndoDescription).toBeNull();
      expect(service.nextRedoDescription).toBeNull();
    });
  });

  describe('execute', () => {
    it('should execute command redo method', () => {
      const redoSpy = jasmine.createSpy('redo');
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: redoSpy
      };

      service.execute(command);

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('should add command to undo stack', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.execute(command);

      expect(service.canUndo).toBe(true);
      expect(service.undoCount).toBe(1);
    });

    it('should clear redo stack when executing new command', () => {
      const command1: EditCommand = {
        type: 'test',
        description: 'Command 1',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };
      const command2: EditCommand = {
        type: 'test',
        description: 'Command 2',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.execute(command1);
      service.undo(); // Move to redo stack
      expect(service.canRedo).toBe(true);

      service.execute(command2); // Should clear redo stack
      expect(service.canRedo).toBe(false);
    });

    it('should limit history to max size', () => {
      // Execute 60 commands (max is 50)
      for (let i = 0; i < 60; i++) {
        const command: EditCommand = {
          type: 'test',
          description: `Command ${i}`,
          timestamp: Date.now(),
          undo: jasmine.createSpy('undo'),
          redo: jasmine.createSpy('redo')
        };
        service.execute(command);
      }

      expect(service.undoCount).toBe(50);
    });
  });

  describe('record', () => {
    it('should add command to undo stack without executing', () => {
      const redoSpy = jasmine.createSpy('redo');
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: redoSpy
      };

      service.record(command);

      expect(redoSpy).not.toHaveBeenCalled();
      expect(service.canUndo).toBe(true);
    });
  });

  describe('undo', () => {
    it('should return null when undo stack is empty', () => {
      const result = service.undo();
      expect(result).toBeNull();
    });

    it('should call command undo method', () => {
      const undoSpy = jasmine.createSpy('undo');
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: undoSpy,
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      service.undo();

      expect(undoSpy).toHaveBeenCalledTimes(1);
    });

    it('should move command to redo stack', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      service.undo();

      expect(service.canUndo).toBe(false);
      expect(service.canRedo).toBe(true);
    });

    it('should return the undone command', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      const result = service.undo();

      expect(result).toBe(command);
    });
  });

  describe('redo', () => {
    it('should return null when redo stack is empty', () => {
      const result = service.redo();
      expect(result).toBeNull();
    });

    it('should call command redo method', () => {
      const redoSpy = jasmine.createSpy('redo');
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: redoSpy
      };

      service.record(command);
      service.undo();
      service.redo();

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('should move command back to undo stack', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      service.undo();
      service.redo();

      expect(service.canUndo).toBe(true);
      expect(service.canRedo).toBe(false);
    });

    it('should return the redone command', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      service.undo();
      const result = service.redo();

      expect(result).toBe(command);
    });
  });

  describe('clear', () => {
    it('should clear both stacks', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'Test command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      service.record(command);
      service.undo();

      service.clear();

      expect(service.canUndo).toBe(false);
      expect(service.canRedo).toBe(false);
    });
  });

  describe('getHistorySummary', () => {
    it('should return descriptions of all commands', () => {
      const command1: EditCommand = {
        type: 'test',
        description: 'Command 1',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };
      const command2: EditCommand = {
        type: 'test',
        description: 'Command 2',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command1);
      service.record(command2);
      service.undo(); // Move command2 to redo

      const summary = service.getHistorySummary();

      expect(summary.undoStack).toEqual(['Command 1']);
      expect(summary.redoStack).toEqual(['Command 2']);
    });
  });

  describe('nextUndoDescription', () => {
    it('should return description of next undo command', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'My Test Command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);

      expect(service.nextUndoDescription).toBe('My Test Command');
    });
  });

  describe('nextRedoDescription', () => {
    it('should return description of next redo command', () => {
      const command: EditCommand = {
        type: 'test',
        description: 'My Test Command',
        timestamp: Date.now(),
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo')
      };

      service.record(command);
      service.undo();

      expect(service.nextRedoDescription).toBe('My Test Command');
    });
  });
});

describe('PaintCommand', () => {
  let applyPaintSpy: jasmine.Spy;

  beforeEach(() => {
    applyPaintSpy = jasmine.createSpy('applyPaint');
  });

  it('should have correct type', () => {
    const command = new PaintCommand([], TerrainType.CRYSTAL, applyPaintSpy);
    expect(command.type).toBe('paint');
  });

  it('should have correct description for single tile', () => {
    const tiles: TileState[] = [
      { x: 0, z: 0, type: TerrainType.BEDROCK, height: 0 }
    ];
    const command = new PaintCommand(tiles, TerrainType.CRYSTAL, applyPaintSpy);
    expect(command.description).toContain('Paint tile');
  });

  it('should have correct description for multiple tiles', () => {
    const tiles: TileState[] = [
      { x: 0, z: 0, type: TerrainType.BEDROCK, height: 0 },
      { x: 1, z: 0, type: TerrainType.BEDROCK, height: 0 }
    ];
    const command = new PaintCommand(tiles, TerrainType.CRYSTAL, applyPaintSpy);
    expect(command.description).toContain('2 tiles');
  });

  it('should restore original types on undo', () => {
    const tiles: TileState[] = [
      { x: 0, z: 0, type: TerrainType.BEDROCK, height: 0 },
      { x: 1, z: 1, type: TerrainType.MOSS, height: 0 }
    ];
    const command = new PaintCommand(tiles, TerrainType.CRYSTAL, applyPaintSpy);

    command.undo();

    expect(applyPaintSpy).toHaveBeenCalledWith(0, 0, TerrainType.BEDROCK);
    expect(applyPaintSpy).toHaveBeenCalledWith(1, 1, TerrainType.MOSS);
  });

  it('should apply new type on redo', () => {
    const tiles: TileState[] = [
      { x: 0, z: 0, type: TerrainType.BEDROCK, height: 0 },
      { x: 1, z: 1, type: TerrainType.MOSS, height: 0 }
    ];
    const command = new PaintCommand(tiles, TerrainType.CRYSTAL, applyPaintSpy);

    command.redo();

    expect(applyPaintSpy).toHaveBeenCalledWith(0, 0, TerrainType.CRYSTAL);
    expect(applyPaintSpy).toHaveBeenCalledWith(1, 1, TerrainType.CRYSTAL);
  });
});

describe('HeightCommand', () => {
  let applyHeightSpy: jasmine.Spy;

  beforeEach(() => {
    applyHeightSpy = jasmine.createSpy('applyHeight');
  });

  it('should have correct type', () => {
    const command = new HeightCommand([], new Map(), applyHeightSpy);
    expect(command.type).toBe('height');
  });

  it('should restore original heights on undo', () => {
    const tiles: TileState[] = [
      { x: 0, z: 0, type: TerrainType.BEDROCK, height: 1.0 },
      { x: 1, z: 1, type: TerrainType.BEDROCK, height: 2.0 }
    ];
    const newHeights = new Map<string, number>();
    newHeights.set('0,0', 1.5);
    newHeights.set('1,1', 2.5);

    const command = new HeightCommand(tiles, newHeights, applyHeightSpy);

    command.undo();

    expect(applyHeightSpy).toHaveBeenCalledWith(0, 0, 1.0);
    expect(applyHeightSpy).toHaveBeenCalledWith(1, 1, 2.0);
  });

  it('should apply new heights on redo', () => {
    const tiles: TileState[] = [
      { x: 0, z: 0, type: TerrainType.BEDROCK, height: 1.0 }
    ];
    const newHeights = new Map<string, number>();
    newHeights.set('0,0', 3.0);

    const command = new HeightCommand(tiles, newHeights, applyHeightSpy);

    command.redo();

    expect(applyHeightSpy).toHaveBeenCalledWith(0, 0, 3.0);
  });
});

describe('SpawnPointCommand', () => {
  let applySpawnSpy: jasmine.Spy;

  beforeEach(() => {
    applySpawnSpy = jasmine.createSpy('applySpawn');
  });

  it('should have correct type', () => {
    const command = new SpawnPointCommand(null, { x: 5, z: 5 }, applySpawnSpy);
    expect(command.type).toBe('spawn');
  });

  it('should have correct description', () => {
    const command = new SpawnPointCommand(null, { x: 5, z: 5 }, applySpawnSpy);
    expect(command.description).toBe('Set spawn point');
  });

  it('should restore previous spawn on undo', () => {
    const previousSpawn: GridPoint = { x: 0, z: 0 };
    const newSpawn: GridPoint = { x: 5, z: 5 };
    const command = new SpawnPointCommand(previousSpawn, newSpawn, applySpawnSpy);

    command.undo();

    expect(applySpawnSpy).toHaveBeenCalledWith(0, 0);
  });

  it('should not call applySpawn on undo if no previous spawn', () => {
    const command = new SpawnPointCommand(null, { x: 5, z: 5 }, applySpawnSpy);

    command.undo();

    expect(applySpawnSpy).not.toHaveBeenCalled();
  });

  it('should apply new spawn on redo', () => {
    const command = new SpawnPointCommand({ x: 0, z: 0 }, { x: 5, z: 5 }, applySpawnSpy);

    command.redo();

    expect(applySpawnSpy).toHaveBeenCalledWith(5, 5);
  });
});

describe('ExitPointCommand', () => {
  let applyExitSpy: jasmine.Spy;

  beforeEach(() => {
    applyExitSpy = jasmine.createSpy('applyExit');
  });

  it('should have correct type', () => {
    const command = new ExitPointCommand(null, { x: 10, z: 10 }, applyExitSpy);
    expect(command.type).toBe('exit');
  });

  it('should have correct description', () => {
    const command = new ExitPointCommand(null, { x: 10, z: 10 }, applyExitSpy);
    expect(command.description).toBe('Set exit point');
  });

  it('should restore previous exit on undo', () => {
    const previousExit: GridPoint = { x: 24, z: 12 };
    const newExit: GridPoint = { x: 10, z: 10 };
    const command = new ExitPointCommand(previousExit, newExit, applyExitSpy);

    command.undo();

    expect(applyExitSpy).toHaveBeenCalledWith(24, 12);
  });

  it('should apply new exit on redo', () => {
    const command = new ExitPointCommand({ x: 0, z: 0 }, { x: 10, z: 10 }, applyExitSpy);

    command.redo();

    expect(applyExitSpy).toHaveBeenCalledWith(10, 10);
  });
});

describe('CompositeCommand', () => {
  it('should have correct type', () => {
    const command = new CompositeCommand('Test composite', []);
    expect(command.type).toBe('composite');
  });

  it('should undo commands in reverse order', () => {
    const order: number[] = [];
    const cmd1: EditCommand = {
      type: 'test',
      description: 'Command 1',
      timestamp: Date.now(),
      undo: () => order.push(1),
      redo: jasmine.createSpy('redo')
    };
    const cmd2: EditCommand = {
      type: 'test',
      description: 'Command 2',
      timestamp: Date.now(),
      undo: () => order.push(2),
      redo: jasmine.createSpy('redo')
    };

    const composite = new CompositeCommand('Test', [cmd1, cmd2]);
    composite.undo();

    expect(order).toEqual([2, 1]); // Reverse order
  });

  it('should redo commands in original order', () => {
    const order: number[] = [];
    const cmd1: EditCommand = {
      type: 'test',
      description: 'Command 1',
      timestamp: Date.now(),
      undo: jasmine.createSpy('undo'),
      redo: () => order.push(1)
    };
    const cmd2: EditCommand = {
      type: 'test',
      description: 'Command 2',
      timestamp: Date.now(),
      undo: jasmine.createSpy('undo'),
      redo: () => order.push(2)
    };

    const composite = new CompositeCommand('Test', [cmd1, cmd2]);
    composite.redo();

    expect(order).toEqual([1, 2]); // Original order
  });
});
