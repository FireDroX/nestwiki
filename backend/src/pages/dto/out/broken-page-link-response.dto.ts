export interface BrokenPageLinkDto {
  sourcePage: {
    id: string;
    title: string;
    path: string;
  };
  targetPath: string;
}

export interface BrokenPageLinkListDto {
  items: BrokenPageLinkDto[];
  total: number;
}
