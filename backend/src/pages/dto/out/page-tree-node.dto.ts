export interface PageTreeNodeDto {
  id: string;
  slug: string;
  title: string;
  canCreateChild: boolean;
  children: PageTreeNodeDto[];
}
