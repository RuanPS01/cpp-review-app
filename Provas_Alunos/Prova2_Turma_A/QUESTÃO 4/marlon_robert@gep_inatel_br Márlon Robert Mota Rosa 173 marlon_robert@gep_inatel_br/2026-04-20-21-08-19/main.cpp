#include <iostream>
#include <iomanip>
#include <cstring>

using namespace std;

int main(){
    
    int N;
    
    int soma=0;
    double media=0;
    
    char sinal[10];
    
    int vetor[9999];
    
    cin >> N;
    
    cin.getline(sinal,10);
    
    
    
    while (N!=0){
        for(int i = 0; i < 9999; i++){
            vetor[i];
        }    
        for(int i= 0;i < 99999; i++) {
            
            if(sinal[i]="positivos" && vetor[i]>0){
                soma=soma+vetor[i];
                i++;
            }
            else{
                soma=soma+vetor[i];
                i++;
            }
            media=double(soma)/i;
        }
        cout << fixed << setprecision(3) << "media = " << media << endl;
        
        return 0;
        
    }
    
    
    
    
    
    
    
    
    
    
    return 0;
}