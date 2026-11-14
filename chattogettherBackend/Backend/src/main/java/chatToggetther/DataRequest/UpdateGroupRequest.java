package chatToggetther.DataRequest;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UpdateGroupRequest {
    @Size(max = 120, message = "Tên cộng đồng tối đa 120 ký tự")
    private String name;

    @Size(max = 2000, message = "Mô tả tối đa 2000 ký tự")
    private String description;

    @Size(max = 5000, message = "Nội quy cộng đồng tối đa 5000 ký tự")
    private String rules;

    private String coverUrl;
    private String avatarUrl;
    private Boolean isPrivate;
    private Boolean requiresApproval;
    private Boolean requireMemberApproval;
    private Boolean isPublicToFeed;
    private Boolean allowFeedPromotion;
    private Boolean requiresPostApproval;
    private Boolean requirePostApproval;
    private Long categoryId;
    private String categoryCode;
    private String status;
    private Boolean isFeatured;
    private Boolean isPinnedFeatured;
    private Long activeVoiceRoomId;
}
