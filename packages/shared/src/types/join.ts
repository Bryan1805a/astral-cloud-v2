export interface VpsTag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface ServerTag {
  serverId: string;
  tagId: string;
}

export interface PlanRegion {
  planId: string;
  regionId: string;
}

export interface ImageRegion {
  imageId: string;
  regionId: string;
}
