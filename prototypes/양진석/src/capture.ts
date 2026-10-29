import {useState,useRef} from 'react';
import {AudioModule,RecordingPresets,useAudioRecorder,setAudioModeAsync} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
export function useCapture(){const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);const [recording,setRecording]=useState(false);const startTime=useRef(0);
 async function start(){const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted)throw new Error('마이크 권한이 필요해요. 글로 남기기는 계속 사용할 수 있어요.');await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record();startTime.current=Date.now();setRecording(true);}
 async function stop(){await recorder.stop();setRecording(false);const uri=recorder.uri;if(!uri)throw new Error('녹음 파일을 찾지 못했어요.');const path=FileSystem.documentDirectory+'audio-'+Date.now()+'.m4a';await FileSystem.copyAsync({from:uri,to:path});return {audioUri:path,audioMime:'audio/mp4',duration:Math.max(1,Math.round((Date.now()-startTime.current)/1000))};}
 async function startFixture(){throw new Error('브라우저 개발 검증 전용 기능이에요.');}
 return {recording,start,stop,startFixture};
}
