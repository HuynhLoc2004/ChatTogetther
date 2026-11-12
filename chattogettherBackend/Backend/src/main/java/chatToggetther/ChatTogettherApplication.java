package chatToggetther;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class ChatTogettherApplication {

	@PostConstruct
	public void init() {
		// Set timezone to Vietnam (Asia/Ho_Chi_Minh) globally across JVM and database timestamps
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
	}

	public static void main(String[] args) {
		SpringApplication.run(ChatTogettherApplication.class, args);
	}

}
