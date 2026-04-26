package chatToggetther;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ChatTogettherApplication {

	public static void main(String[] args) {
		SpringApplication.run(ChatTogettherApplication.class, args);
	}

}
