#include <iostream>

using namespace std;

int main(){
    int n;
    int ids;
    int pos = -1;
    int vetor[100];
    int pagou;
    int naodeve;
    cin >> n;
    for(int i = 0; i < n; i++){
        cin >> ids;
        ids = vetor[i];   
        cin >> pagou;
        for(int i = 0; i < n; i++){
            if(vetor[i] == pagou){
                pos = i;
            }
        }
        cout << vetor[i] << endl;
    }
    
    

    
    
    return 0;
}