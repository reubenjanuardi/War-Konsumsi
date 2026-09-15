import { describe, it, expect, vi } from 'vitest';
import { HealthController } from '../src/modules/health/health.controller.js';
import { Response } from 'express';

describe('HealthController', () => {
  it('should return ok when database is healthy', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const controller = new HealthController(mockDb as any);

    let sentStatus = 0;
    let sentJson: any = null;

    const mockRes = {
      status: (code: number) => {
        sentStatus = code;
        return mockRes;
      },
      json: (payload: any) => {
        sentJson = payload;
        return mockRes;
      },
    } as unknown as Response;

    await controller.check(mockRes);

    expect(sentStatus).toBe(200);
    expect(sentJson.status).toBe('ok');
    expect(sentJson.database).toBe('connected');
    expect(typeof sentJson.uptimeSeconds).toBe('number');
  });

  it('should return 503 when database is disconnected', async () => {
    const mockDb = {
      execute: vi.fn().mockRejectedValue(new Error('Connection failed')),
    };

    const controller = new HealthController(mockDb as any);

    let sentStatus = 0;
    let sentJson: any = null;

    const mockRes = {
      status: (code: number) => {
        sentStatus = code;
        return mockRes;
      },
      json: (payload: any) => {
        sentJson = payload;
        return mockRes;
      },
    } as unknown as Response;

    await controller.check(mockRes);

    expect(sentStatus).toBe(503);
    expect(sentJson.status).toBe('error');
    expect(sentJson.database).toBe('disconnected');
  });
});
