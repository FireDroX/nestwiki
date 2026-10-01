export class AvatarNotFoundException extends Error {
  constructor() {
    super('Avatar not found');
    this.name = 'AvatarNotFoundException';
  }
}
