package chatToggetther.configuration;

import chatToggetther.ENUMS.PermissionAdminEnum;
import chatToggetther.ENUMS.RoleAdminEnum;
import chatToggetther.ENUMS.RoleUserEnum;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Slf4j
@Configuration
public class ApprunerConfiguration {
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
    private final UserRepository userRepository;

    public ApprunerConfiguration(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Bean
    ApplicationRunner applicationRunner(){
        return args -> {
            if(this.userRepository.findByAccount("admin").isPresent()){
                log.info("đã tạo admin");
            }else{
                UserEntity userEntity = new UserEntity();
                userEntity.setAccount("admin");
                userEntity.setPassword(passwordEncoder.encode("admin"));
                userEntity.setNickname("Bò đen");
                userEntity.setPhone("0977958350");
                userEntity.setRoles(List.of(RoleAdminEnum.ROLE_AMDIN.toString()));
                userEntity.setPermissions(List.of(PermissionAdminEnum.FULL.toString() , PermissionAdminEnum.DELETE.toString() , PermissionAdminEnum.UPDATE.toString() , PermissionAdminEnum.WRITE.toString() , PermissionAdminEnum.READ.toString()));
                this.userRepository.save(userEntity);
            }
        };
    }
}
