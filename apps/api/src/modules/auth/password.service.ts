import { Injectable, type OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Parámetros mínimos recomendados por OWASP para Argon2id (19 MiB, 2 iteraciones, 1 hilo). */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash('timing-equalizer-not-a-real-password', ARGON2_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /**
   * Con `storedHash` nulo (usuario inexistente) verifica contra un hash señuelo para que el
   * tiempo de respuesta no revele qué emails existen.
   */
  async verify(storedHash: string | null, password: string): Promise<boolean> {
    try {
      const matches = await verify(storedHash ?? this.dummyHash, password);
      return storedHash !== null && matches;
    } catch {
      return false;
    }
  }
}
