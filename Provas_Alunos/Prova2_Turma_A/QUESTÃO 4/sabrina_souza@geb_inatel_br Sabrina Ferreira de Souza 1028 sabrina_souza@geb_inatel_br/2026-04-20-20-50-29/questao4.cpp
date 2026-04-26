#include <iostream>
#include <cstring>
using namespace std;

int main(){
    int N, soma=0, quant=0, media=0;
    char *vetor[9];
    
    do {
        cin >> N;
        if(N > 0){
            soma += N;
            quant += 1;
        } else if(N < 0){
            soma += N;
            quant += 1;
        }
    } while(N == 0);
    
    media = soma/quant;
    
    cin >> vetor[9];
    
    return 0;
}