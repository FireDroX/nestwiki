import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
} from 'typeorm';

/**
 * `@CreateDateColumn` normally falls back to the DB's own `DEFAULT
 * CURRENT_TIMESTAMP` when the app doesn't set a value before insert —
 * which resolves in the MariaDB server's own session timezone,
 * not necessarily UTC. In production that server is an external
 * instance this app doesn't own or configure (see
 * docker-compose.external.yml), so a non-UTC server timezone there
 * silently skews every `createdAt` by that offset once the driver's
 * `timezone: 'Z'` option (typeorm.config.ts) reads it back as UTC.
 * Setting the value from Node instead sidesteps the DB session
 * timezone entirely: a JS `Date` is always a real UTC instant.
 */
@EventSubscriber()
export class TimestampSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<ObjectLiteral>): void {
    const column = event.metadata.createDateColumn;
    if (column && column.getEntityValue(event.entity) === undefined) {
      column.setEntityValue(event.entity, new Date());
    }
  }
}
