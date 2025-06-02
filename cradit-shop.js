const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;  // 서버 포트

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Content-Type:', req.headers['content-type']);
    next();
});

// CORS 허용 (개발 환경)
app.use(cors());

// body-parser 설정 (두 가지 형식 모두 지원)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 서빙 (public 폴더)
app.use(express.static(path.join(__dirname, 'public')));

function sendToServer(rsp) {
    // 결제 정보 로깅
    console.log('전송할 결제 정보:', rsp);
    
    // 기본 데이터 포맷
    const requestData = {
        imp_uid: rsp.imp_uid,
        merchant_uid: rsp.merchant_uid
    };
    
    console.log('서버로 보낼 데이터:', requestData);
    
    // fetch API를 사용한 요청 (jQuery 대신)
    fetch('http://localhost:3000/payments/complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('응답 상태:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('서버 응답 데이터:', data);
        if(data.success) {
            alert('결제가 성공적으로 처리되었습니다.');
        } else {
            alert('결제 검증 실패: ' + (data.message || '알 수 없는 오류'));
        }
    })
    .catch(error => {
        console.error('서버 통신 오류:', error);
        alert('서버 통신 실패: ' + error.message);
    });
}