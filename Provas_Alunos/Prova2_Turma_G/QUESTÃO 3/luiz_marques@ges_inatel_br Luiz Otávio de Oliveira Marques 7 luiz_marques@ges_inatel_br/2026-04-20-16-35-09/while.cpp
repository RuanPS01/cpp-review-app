#include<iostream>
#include<iomanip>
using namespace std;
int main(){
    int temp;
    int maior = -1;
    int soma = 0;
    int contador = 0;
    double media = 0;
    
    cin>>temp;
    while(temp != 0){
        
        
        if(temp > maior){
            maior = temp;
    
        }
        soma+=temp;
        contador++;
        cin>>temp;
    }
    
    media=(double)soma/contador;
    cout<<"Maior tempo: "<<maior<<" minutos"<<endl;
    cout<<fixed<<setprecision(2);
    cout<<"Media dos tempos: "<<media<<" minutos"<<endl;
    return 0;
}