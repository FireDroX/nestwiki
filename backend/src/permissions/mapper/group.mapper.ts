import { ResponseDto } from '../../common/dto/response.dto.js';
import { Group } from '../entities/group.entity.js';
import type {
  GroupDetailDto,
  GroupSummaryDto,
} from '../dto/out/group-response.dto.js';
import type { GroupDetail, GroupSummary } from '../services/groups.service.js';
import { AccessRuleMapper } from './access-rule.mapper.js';

export class GroupMapper {
  static toSummaryDto(summary: GroupSummary): GroupSummaryDto {
    return {
      id: summary.group.id,
      name: summary.group.name,
      description: summary.group.description,
      memberCount: summary.memberCount,
      ruleCount: summary.ruleCount,
    };
  }

  static toListResponse(
    summaries: GroupSummary[],
  ): ResponseDto<GroupSummaryDto[]> {
    return new ResponseDto(
      summaries.map((summary) => GroupMapper.toSummaryDto(summary)),
    );
  }

  static toDetailDto(detail: GroupDetail): GroupDetailDto {
    return {
      id: detail.group.id,
      name: detail.group.name,
      description: detail.group.description,
      members: detail.members,
      permissions: detail.permissions,
      rules: detail.rules.map((rule) => AccessRuleMapper.toResponseDto(rule)),
    };
  }

  static toDetailResponse(detail: GroupDetail): ResponseDto<GroupDetailDto> {
    return new ResponseDto(GroupMapper.toDetailDto(detail));
  }

  static toGroupDto(group: Group): {
    id: string;
    name: string;
    description: string | null;
  } {
    return { id: group.id, name: group.name, description: group.description };
  }

  static toGroupResponse(
    group: Group,
  ): ResponseDto<{ id: string; name: string; description: string | null }> {
    return new ResponseDto(GroupMapper.toGroupDto(group));
  }
}
