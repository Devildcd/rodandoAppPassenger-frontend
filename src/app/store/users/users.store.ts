import { computed, Injectable, Signal, signal } from "@angular/core";
import { User } from "src/app/core/models/user/user.response";

interface UsersState {
  ids: string[];
  entities: Record<string, User>;
  lastCreatedUserId?: string | null;
  loading?: boolean;
  error?: unknown;
}

const initialState: UsersState = {
  ids: [],
  entities: {},
  lastCreatedUserId: null,
  loading: false,
  error: null,
}

@Injectable({ providedIn: 'root' })
export class UsersStore {
  private _state = signal<UsersState> ({...initialState});

  // Public read-only signals
  readonly ids: Signal<string[]> = computed(() => this._state().ids);
  readonly entities: Signal<Record<string, User>> = computed(() => this._state().entities);
  readonly all: Signal<User[]> = computed(() =>
    this._state().ids.map(id => this._state().entities[id])
  );
  readonly lastCreatedUserId: Signal<string | null | undefined> = computed(() => this._state().lastCreatedUserId);

  // getter for currentUser (if used)
  getById(id: string): User | undefined {
    return this._state().entities[id];
  }

  // Upsert single user (insert or merge)
  upsertOne(user: User): void {
    this._state.update(state => {
      const exists = !!state.entities[user.id];
      const newEntities = { ...state.entities, [user.id]: { ...(state.entities[user.id] || {}), ...user } };
      const newIds = exists ? state.ids : [...state.ids, user.id];
      return { ...state, entities: newEntities, ids: newIds, lastCreatedUserId: user.id };
    });
  }

  updateCurrentLocation(userId: string, lat: number, lng: number, reportedAt?: string) {
  this._state.update(state => {
    const cur = state.entities[userId];
    if (!cur) return state;
    const next = {
      ...cur,
      currentLocation: { lat, lng, reportedAt: reportedAt ?? new Date().toISOString() } as any
    };
    return {
      ...state,
      entities: { ...state.entities, [userId]: next }
    };
  });
}

  // Remove a user (if ever needed)
  removeOne(id: string): void {
    this._state.update(state => {
      if (!state.entities[id]) return state;
      const { [id]: _, ...rest } = state.entities;
      const newIds = state.ids.filter(x => x !== id);
      const lastCreatedUserId = state.lastCreatedUserId === id ? null : state.lastCreatedUserId;
      return { ...state, entities: rest, ids: newIds, lastCreatedUserId };
    });
  }

  // Optional: reset all users
  reset(): void {
    this._state.set({ ...initialState });
  }

}
