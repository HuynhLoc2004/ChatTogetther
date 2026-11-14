package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LockTargetRequest {
    @NotNull(message = "targetUserId không được để trống")
    private Long targetUserId;
}
